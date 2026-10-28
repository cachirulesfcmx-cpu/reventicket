#!/usr/bin/env bash
# Proves the staging rollback script fully reverses the migrations and that they re-apply cleanly.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT="${PGPORT_TEST:-54331}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -X -q -t -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/supabase_stub.sql" >/dev/null
"${PSQL[@]}" -c "create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key);" >/dev/null
apply() { for m in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$m" >/dev/null; done; }
apply
before=$("${PSQL[@]}" -c "select count(*) from pg_tables where schemaname='public'")
"${PSQL[@]}" -f "$HERE/../rollback/20261028_staging_down.sql" >/dev/null
after=$("${PSQL[@]}" -c "select count(*) from pg_tables where schemaname='public'")
funcs=$("${PSQL[@]}" -c "select count(*) from pg_proc p where pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')")
[ "$(echo $after)" = "0" ] && [ "$(echo $funcs)" = "0" ] || { echo "rollback left objects: tables=$after functions=$funcs"; exit 1; }
apply
echo "ROLLBACK TEST PASSED (tables before=$(echo $before), after rollback=0, re-apply OK)"
