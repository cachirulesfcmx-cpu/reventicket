#!/usr/bin/env bash
# Local performance check: seeds a realistic volume, then runs pgbench against the hottest
# RLS-protected read path and the atomic AI quota under concurrency. Results are indicative
# of query plans/locking only (local hardware, no network, no PostgREST).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT="${PGPORT_TEST:-54330}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c max_connections=100" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/supabase_stub.sql" >/dev/null
for m in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$m" >/dev/null; done

USERS="${PERF_USERS:-2000}"
echo "seeding $USERS users x 20 plans x 8 sessions ..."
"${PSQL[@]}" <<SQL
insert into auth.users (id, email, raw_user_meta_data)
select gen_random_uuid(), 'u'||g||'@example.com', '{"adult_attested":"true","privacy_notice_version":"v1"}'
from generate_series(1, $USERS) g;
insert into public.study_plans (user_id, title, subject_slug, topics, exam_date)
select u.id, 'Plan '||g, 'matematicas', array['a','b','c'], current_date + 10 from auth.users u, generate_series(1,20) g;
insert into public.study_sessions (plan_id, user_id, position, topic)
select p.id, p.user_id, g, 't'||g from public.study_plans p, generate_series(1,8) g;
analyze;
SQL
"${PSQL[@]}" -t -c "select 'rows: plans='||(select count(*) from public.study_plans)||' sessions='||(select count(*) from public.study_sessions)"
"${PSQL[@]}" -t -c "select string_agg(id::text, E'\n') from (select id from auth.users order by random() limit 200) x" | sed '/^\s*$/d; s/^ *//' > "$WORK/users.txt"

cat > "$WORK/read.sql" <<'B'
\set n random(1, 200)
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users order by id offset :n limit 1), true);
set local role authenticated;
select p.id, p.title, (select count(*) from public.study_sessions s where s.plan_id = p.id) from public.study_plans p where p.status = 'active' order by p.created_at desc limit 20;
commit;
B
cat > "$WORK/quota.sql" <<'B'
\set n random(1, 50)
select id as uid from auth.users order by id offset :n limit 1 \gset
begin;
set local role service_role;
select public.consume_ai_quota(':uid'::uuid, 1000000);
commit;
B
"${PSQL[@]}" -c "update public.plan_limits set daily_requests = 1000000" >/dev/null
echo "== RLS plan list (20 plans + session counts), 16 clients, 20s"
"$PGBIN/pgbench" -n -h "$WORK" -p "$PORT" -U postgres -c 16 -j 4 -T 20 -f "$WORK/read.sql" postgres 2>&1 | grep -E "tps|latency average|number of transactions actually processed|failed"
echo "== consume_ai_quota on 50 hot users (row contention), 32 clients, 20s"
"$PGBIN/pgbench" -n -h "$WORK" -p "$PORT" -U postgres -c 32 -j 4 -T 20 -f "$WORK/quota.sql" postgres 2>&1 | grep -E "tps|latency average|number of transactions actually processed|failed"
"${PSQL[@]}" -t -c "select 'quota rows consistent: '||(select sum(requests) from public.ai_usage_daily)||' increments recorded'"
echo "== plan for the RLS read path"
"${PSQL[@]}" <<'SQL'
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users limit 1), true);
set local role authenticated;
explain (analyze, costs off, timing off, summary on) select id, title from public.study_plans where status = 'active' order by created_at desc limit 20;
commit;
SQL
