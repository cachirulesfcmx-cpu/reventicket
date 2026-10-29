#!/usr/bin/env bash
# Reproducible local proof of Plan B (dedicated `reventicket` schema). Throwaway PostgreSQL only.
#   Usage: bash run.sh <main-checkout> <fixes+0005-checkout>
#   Both checkouts: `npm ci`, `npm rebuild bcrypt`, `npm run build:server` done. Neither is modified.
# Emulates Supabase: `rt_owner` stands in for `postgres` (owns the tables, NOT superuser, BYPASSRLS, CREATEROLE,
# member of anon/authenticated, default privileges granting client roles ALL in public); VANTA EDGE migrations in
# public; the 8 legacy tables with their real structure and fictitious rows.
set -euo pipefail
MAIN="$(cd "${1:?main checkout}" && pwd)"; ISO="$(cd "${2:?fixes+0005 checkout}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../../../../.."
MOVE="$HERE/../20261029_reventicket_move_to_own_schema.sql"; DOWN="$HERE/../20261029_reventicket_move_to_own_schema_down.sql"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)
WORKS=(); PID=""
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
  for w in "${WORKS[@]}"; do "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$w/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$w"; done; }
trap cleanup EXIT
pass() { echo "PASS  $*"; }; fail() { echo "FAIL  $*"; [ -n "${DEBUG_OUT:-}" ] && mkdir -p "$DEBUG_OUT" && cp "$W"/*.log "$DEBUG_OUT"/ 2>/dev/null; exit 1; }
chk() { local m="$1"; shift; if eval "$*"; then pass "$m"; else fail "$m"; fi; }
APP_PW="local-$(openssl rand -hex 16)"   # throwaway, this run only

newdb() { # $1 port -> prints work dir; cluster with stub + rt_owner + VANTA + legacy fixture
  local w; w=$(mktemp -d); WORKS+=("$w"); [ "$(id -u)" = "0" ] && chown -R postgres "$w"
  "${RUNAS[@]}" "$PGBIN/initdb" -D "$w/data" -A trust -U postgres >/dev/null
  "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$w/data" -o "-p $1 -k $w -c listen_addresses=127.0.0.1" -l "$w/log" -w start >/dev/null
  local su=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$1" -U postgres -d postgres)
  "${su[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql" >/dev/null
  for m in "$ROOT"/supabase/migrations/*.sql; do "${su[@]}" -f "$m" >/dev/null 2>&1; done
  "${su[@]}" >/dev/null <<'SQL'
create role rt_owner login nosuperuser bypassrls createrole;
grant anon, authenticated to rt_owner;
grant create, usage on schema public to rt_owner;
grant create on database postgres to rt_owner;
alter default privileges for role rt_owner in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role rt_owner in schema public grant all on sequences to anon, authenticated, service_role;
SQL
  psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$1" -U rt_owner -d postgres -f "$ROOT/supabase/proposals/reventicket/test/legacy_fixture.sql" >/dev/null
  echo "$w"
}
P1=55951; newdb $P1 >/dev/null
SU=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $P1 -U postgres -d postgres)
OWN=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $P1 -U rt_owner -d postgres)
VANTA="'teams','games','game_facts','odds_snapshots','model_versions','predictions','followed_teams','user_preferences','profiles','data_sources','ingestion_runs','data_freshness','published_performance'"
LEGACY="'config','events','orders','otp_codes','tickets','users','venues','zones'"
vanta_fp() { "${SU[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select 'rel:'||c.relname||':'||c.relkind::text||':'||pg_get_userbyid(c.relowner)||':'||c.relrowsecurity x from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ($VANTA)
  union all select 'acl:'||c.relname||':'||coalesce(pg_get_userbyid(a.grantee),'PUBLIC')||':'||a.privilege_type from pg_class c, aclexplode(c.relacl) a where c.relnamespace='public'::regnamespace and c.relname in ($VANTA)
  union all select 'col:'||table_name||'.'||column_name||':'||data_type||':'||coalesce(column_default,'') from information_schema.columns where table_schema='public' and table_name in ($VANTA)
  union all select 'con:'||conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid) from pg_constraint where conrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname in ($VANTA))
  union all select 'pol:'||tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname='public'
  union all select 'trg:'||tgrelid::regclass::text||':'||tgname from pg_trigger where not tgisinternal and tgname like 'vanta%'
  union all select 'fn:'||p.oid::regprocedure::text||':'||coalesce(p.proacl::text,'')||':'||md5(p.prosrc) from pg_proc p where p.pronamespace='public'::regnamespace) s"; }
# Row fingerprint independent of the schema/column renames the move performs.
rows_fp() { "${SU[@]}" -c "select md5(string_agg(j, '|' order by j)) from (
  select (to_jsonb(t) - 'is_featured' - 'verified' - 'used')::text j from $1.users t union all
  select (to_jsonb(t) - 'is_featured')::text from $1.venues t union all select (to_jsonb(t) - 'is_featured')::text from $1.events t union all
  select to_jsonb(t)::text from $1.zones t union all select to_jsonb(t)::text from $1.tickets t union all
  select to_jsonb(t)::text from $1.orders t union all select (to_jsonb(t) - 'verified' - 'used')::text from $1.otp_codes t union all
  select to_jsonb(t)::text from $1.config t) s"; }
legacy_catalog() { "${SU[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select 'rel:'||c.relname||':'||pg_get_userbyid(c.relowner)||':'||c.relrowsecurity x from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ($LEGACY)
  union all select 'acl:'||c.relname||':'||coalesce(pg_get_userbyid(a.grantee),'PUBLIC')||':'||a.privilege_type from pg_class c, aclexplode(c.relacl) a where c.relnamespace='public'::regnamespace and c.relname in ($LEGACY)
  union all select 'col:'||table_name||'.'||column_name||':'||data_type||':'||coalesce(column_default,'')||':'||is_nullable from information_schema.columns where table_schema='public' and table_name in ($LEGACY)
  union all select 'con:'||conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid) from pg_constraint where conrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname in ($LEGACY))
  union all select 'idx:'||indexrelid::regclass::text||':'||pg_get_indexdef(indexrelid) from pg_index where indrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname in ($LEGACY))) s"; }
V0=$(vanta_fp); R0=$(rows_fp public); C0=$(legacy_catalog)
FP=$("${OWN[@]}" -f "$ROOT/supabase/proposals/reventicket/verify_remote.sql" | python3 -c "import json,sys; print(json.load(sys.stdin)['fingerprint'])")
W=$(mktemp -d); WORKS+=("$W"); chmod 755 "$W"
fill() { sed "s/__SET_FROM_VERIFY_REMOTE__'; *$/$1';/" "$MOVE" > "$W/$2"; chmod a+r "$W/$2"; }
fill "$FP" move.sql; fill "${FP:0:8}…${FP: -4}" move_abbrev.sql; fill 00000000000000000000000000000000 move_wrong.sql
unchanged() { [ "$(vanta_fp)" = "$V0" ] && [ "$(legacy_catalog)" = "$C0" ] && [ "$(rows_fp public)" = "$R0" ] && [ "$("${SU[@]}" -c "select to_regnamespace('reventicket') is null")" = "t" ]; }
rejects() { if "${OWN[@]}" -f "$1" >/dev/null 2>"$W/err"; then return 1; fi; grep -q "$2" "$W/err" && unchanged; }

# ---------------------------------------------------------------- backup recoverable
"$PGBIN/pg_dump" -h 127.0.0.1 -p $P1 -U postgres -d postgres -Fc --no-owner --no-acl $(for t in config events orders otp_codes tickets users venues zones; do printf -- "-t public.%s " $t; done) -f "$W/backup.dump"
P2=55952; W2=$(mktemp -d); WORKS+=("$W2"); [ "$(id -u)" = "0" ] && chown -R postgres "$W2"
"${RUNAS[@]}" "$PGBIN/initdb" -D "$W2/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$W2/data" -o "-p $P2 -k $W2 -c listen_addresses=127.0.0.1" -l "$W2/log" -w start >/dev/null
"$PGBIN/pg_restore" --no-owner --no-acl -h 127.0.0.1 -p $P2 -U postgres -d postgres "$W/backup.dump"
SU2=(psql -X -q -t -A -h 127.0.0.1 -p $P2 -U postgres -d postgres)
R2=$("${SU2[@]}" -c "select md5(string_agg(j, '|' order by j)) from (
  select (to_jsonb(t) - 'is_featured' - 'verified' - 'used')::text j from public.users t union all
  select (to_jsonb(t) - 'is_featured')::text from public.venues t union all select (to_jsonb(t) - 'is_featured')::text from public.events t union all
  select to_jsonb(t)::text from public.zones t union all select to_jsonb(t)::text from public.tickets t union all
  select to_jsonb(t)::text from public.orders t union all select (to_jsonb(t) - 'verified' - 'used')::text from public.otp_codes t union all
  select to_jsonb(t)::text from public.config t) s")
chk "backup: pg_dump of the 8 tables restores into an empty database with identical rows" '[ "$R2" = "$R0" ]'

# ---------------------------------------------------------------- guards (abort = nothing changes)
chk "guard: no reventicket_app role -> aborts, nothing changed" 'rejects "$W/move.sql" "create the login role reventicket_app"'
"${OWN[@]}" -c "create role reventicket_app login noinherit nocreatedb nocreaterole nobypassrls password '$APP_PW'" >/dev/null
"${SU[@]}" -c "grant anon to reventicket_app" >/dev/null
chk "guard: reventicket_app member of anon -> aborts, nothing changed" 'rejects "$W/move.sql" "must not be a member"'
"${SU[@]}" -c "revoke anon from reventicket_app" >/dev/null
chk "guard: unfilled fingerprint -> aborts, nothing changed" 'rejects "$MOVE" "must be the full 32-character"'
chk "guard: abbreviated fingerprint -> aborts, nothing changed" 'rejects "$W/move_abbrev.sql" "must be the full 32-character"'
chk "guard: wrong fingerprint -> aborts, nothing changed" 'rejects "$W/move_wrong.sql" "fingerprint mismatch"'
if "${SU[@]}" -f "$W/move.sql" >/dev/null 2>"$W/err"; then fail "ran as non-owner"; fi
chk "guard: a role that does not own the tables -> aborts, nothing changed" 'grep -q "run as the owner" "$W/err" && unchanged'
python3 - "$W/move.sql" "$W/move_inject.sql" <<'PY'
import sys; s = open(sys.argv[1]).read(); i = s.index("  -- ---------------------------------------------------------------- postconditions")
open(sys.argv[2], "w").write(s[:i] + "  raise exception 'RT_INJECTED after the move';\n" + s[i:])
PY
chmod a+r "$W/move_inject.sql"
chk "atomic: failure injected after moving every table -> nothing changed (no schema, no audit rows applied)" 'rejects "$W/move_inject.sql" "RT_INJECTED"'

# ---------------------------------------------------------------- move
chk "move applied (single request, autocommit client) as the table owner" '"${OWN[@]}" -f "$W/move.sql" >/dev/null 2>&1'
chk "rows identical after the move" '[ "$(rows_fp reventicket)" = "$R0" ]'
chk "VANTA EDGE (public) catalog identical: relations, owners, ACL, columns, constraints, policies, triggers, functions" '[ "$(vanta_fp)" = "$V0" ]'
chk "no legacy table left in public; 8 tables + session + push_subscriptions in reventicket owned by reventicket_app" '[ "$("${SU[@]}" -c "select (select count(*) from pg_class where relnamespace='"'"'public'"'"'::regnamespace and relname in ($LEGACY))||'"'"'/'"'"'||(select count(*) from pg_class where relnamespace='"'"'reventicket'"'"'::regnamespace and relkind='"'"'r'"'"' and pg_get_userbyid(relowner)='"'"'reventicket_app'"'"')")" = "0/10" ]'
chk "client roles cannot reach the schema (anon / authenticated / PUBLIC)" '[ "$("${SU[@]}" -c "select has_schema_privilege('"'"'anon'"'"','"'"'reventicket'"'"','"'"'usage'"'"') or has_schema_privilege('"'"'authenticated'"'"','"'"'reventicket'"'"','"'"'usage'"'"')")" = "f" ]'
leak=$("${SU[@]}" -c "begin; set local role anon; select count(*) from reventicket.users; rollback;" 2>&1 || true)
chk "anon querying reventicket.users -> permission denied" 'echo "$leak" | grep -q "permission denied"'
chk "reventicket_app: login, no superuser/bypassrls/createrole, search_path=reventicket, no CREATE on public, no membership in other roles" '[ "$("${SU[@]}" -c "select r.rolcanlogin and not r.rolsuper and not r.rolbypassrls and not r.rolcreaterole and array_to_string(r.rolconfig, '"'"','"'"') = '"'"'search_path=reventicket'"'"' and not has_schema_privilege('"'"'reventicket_app'"'"','"'"'public'"'"','"'"'create'"'"') and not exists (select 1 from pg_auth_members m where m.member = r.oid) from pg_roles r where rolname = '"'"'reventicket_app'"'"'")" = "t" ]'
chk "the executing role cannot use or SET ROLE to reventicket_app afterwards (only the PG16+ creator ADMIN grant remains)" '[ "$("${SU[@]}" -c "select pg_has_role('"'"'rt_owner'"'"','"'"'reventicket_app'"'"','"'"'usage'"'"') or pg_has_role('"'"'rt_owner'"'"','"'"'reventicket_app'"'"','"'"'set'"'"')")" = "f" ]'
chk "re-running the move aborts (schema exists), nothing else changes" '! "${OWN[@]}" -f "$W/move.sql" >/dev/null 2>&1'

# ---------------------------------------------------------------- drizzle-kit as reventicket_app
APPURL="postgres://reventicket_app:$APP_PW@127.0.0.1:$P1/postgres"
(cd "$MAIN" && DATABASE_URL="$APPURL" timeout 120 npx drizzle-kit push --force </dev/null >"$W/push_main.log" 2>&1) || true
chk "db:push of main (no schemaFilter, tables in public) as reventicket_app cannot alter VANTA EDGE" '[ "$(vanta_fp)" = "$V0" ] && [ "$("${SU[@]}" -c "select count(*) from pg_class where relnamespace='"'"'public'"'"'::regnamespace and pg_get_userbyid(relowner)='"'"'reventicket_app'"'"'")" = "0" ]'
(cd "$ISO" && DATABASE_URL="$APPURL" timeout 180 npx drizzle-kit push --force </dev/null >"$W/push_iso.log" 2>&1)
chk "db:push with 0005 (schemaFilter reventicket): creates the 14 missing tables (24 total) without rename/truncate/drop prompts" '! grep -qiE "renamed|truncate|drop" "$W/push_iso.log" && [ "$("${SU[@]}" -c "select count(*) from pg_class where relnamespace='"'"'reventicket'"'"'::regnamespace and relkind='"'"'r'"'"'")" = "24" ]'
chk "rows still identical after push; VANTA EDGE still identical" '[ "$(rows_fp reventicket)" = "$R0" ] && [ "$(vanta_fp)" = "$V0" ]'

# ---------------------------------------------------------------- real backend (fixes + 0005) on the dedicated schema
ADMIN_PASS="T$(openssl rand -hex 12)!"; PEPPER=$(openssl rand -hex 32)
HASH=$(cd "$ISO" && node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" "$ADMIN_PASS")
psql -X -q -v ON_ERROR_STOP=1 "$APPURL" -c "update users set password = '$HASH' where id = 'u-admin'" >/dev/null
(cd "$ISO" && NODE_ENV=production PORT=56951 DATABASE_URL="$APPURL" SESSION_SECRET="$(openssl rand -hex 32)" JWT_SECRET="$(openssl rand -hex 32)" \
   OTP_PEPPER="$PEPPER" ADMIN_PASSWORD="plaintext-bypass-test" WHATSAPP_ENABLED=false JOBS_ENABLED=false exec node dist/index.cjs >"$W/server.log" 2>&1) &
PID=$!
for _ in $(seq 1 60); do curl -sf http://127.0.0.1:56951/api/health >/dev/null 2>&1 && break; sleep 1; done
BASE=http://127.0.0.1:56951 DB="postgres://postgres@127.0.0.1:$P1/postgres?options=-c%20search_path%3Dreventicket" ADMIN_PASS="$ADMIN_PASS" \
  PEPPER="$PEPPER" LABEL=after RT_DIR="$ISO" node "$ROOT/docs/security/reventicket-patches/validate.mjs" > "$W/validate.json"
kill "$PID"; wait "$PID" 2>/dev/null || true; PID=""
python3 - "$W/validate.json" <<'PY' > "$W/validate.txt"
import json, sys
d = json.load(open(sys.argv[1])); e = d.pop("_expect")
bad = [k for k in d if k in e and str(d[k]) != str(e[k])]
print(len(d), len(bad), "; ".join(bad))
PY
read -r NCHK NBAD BADLIST < "$W/validate.txt" || true
chk "backend on reventicket: $NCHK/$NCHK security + regression checks (register, login, OTP, admin, purchase, issuance)${BADLIST:+ — failing: $BADLIST}" '[ "$NBAD" = "0" ] && [ "$NCHK" = "27" ]'
chk "backend created nothing in public; runtime tables (push_subscriptions) landed in reventicket" '[ "$("${SU[@]}" -c "select (select count(*) from pg_class where relnamespace='"'"'public'"'"'::regnamespace and pg_get_userbyid(relowner)='"'"'reventicket_app'"'"')||'"'"'/'"'"'||coalesce((select relnamespace::regnamespace::text from pg_class where relname='"'"'push_subscriptions'"'"'),'"'"'none'"'"')")" = "0/reventicket" ]'
chk "server log: no permission denied, no secrets echoed" '! grep -qE "permission denied|plaintext-bypass-test|$APP_PW" "$W/server.log"'
chk "VANTA EDGE still identical after running the app" '[ "$(vanta_fp)" = "$V0" ]'

# ---------------------------------------------------------------- rollback (exact), on a fresh database
P3=55953; newdb $P3 >/dev/null
SU=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $P3 -U postgres -d postgres)
OWN=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $P3 -U rt_owner -d postgres)
V0=$(vanta_fp); R0=$(rows_fp public); C0=$(legacy_catalog)
FP3=$("${OWN[@]}" -f "$ROOT/supabase/proposals/reventicket/verify_remote.sql" | python3 -c "import json,sys; print(json.load(sys.stdin)['fingerprint'])")
fill "$FP3" move3.sql
"${OWN[@]}" -c "create role reventicket_app login noinherit nocreatedb nocreaterole nobypassrls password '$APP_PW'" >/dev/null
"${OWN[@]}" -f "$W/move3.sql" >/dev/null 2>&1
"${OWN[@]}" -f "$DOWN" > "$W/down.log" 2>&1 || true
chk "rollback restores the exact original catalog (owners, ACL incl. anon/authenticated/service_role, columns, defaults, constraint names)" 'grep -q RT_MOVE_ROLLED_BACK "$W/down.log" && [ "$(legacy_catalog)" = "$C0" ]'
chk "rollback keeps every row and leaves VANTA EDGE identical" '[ "$(rows_fp public)" = "$R0" ] && [ "$(vanta_fp)" = "$V0" ]'
chk "rollback twice -> refuses (nothing active), nothing changes" '! "${OWN[@]}" -f "$DOWN" >/dev/null 2>&1 && [ "$(legacy_catalog)" = "$C0" ]'
echo "PLAN B (DEDICATED SCHEMA): ALL LOCAL CHECKS PASSED on $("${SU[@]}" -c "show server_version")"
