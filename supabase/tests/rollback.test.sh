#!/usr/bin/env bash
# Applies all migrations, runs the hardening rollback, verifies the protections are gone and that
# the hardening migration re-applies cleanly afterwards.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT="${PGPORT_TEST:-54332}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -X -q -t -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/supabase_stub.sql" >/dev/null
"${PSQL[@]}" -c "create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text);" >/dev/null
for m in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$m" >/dev/null 2>&1; done
"${PSQL[@]}" -f "$HERE/../rollback/202610280001_hardening_down.sql" >/dev/null
left=$("${PSQL[@]}" -c "select count(*) from pg_trigger where tgname like 'vanta_%'")
[ "$(echo $left)" = "0" ] || { echo "rollback left vanta triggers"; exit 1; }
"${PSQL[@]}" -f "$HERE/../migrations/202610280001_hardening.sql" >/dev/null 2>&1
back=$("${PSQL[@]}" -c "select count(*) from pg_trigger where tgname like 'vanta_%'")
[ "$(echo $back)" = "3" ] || { echo "re-apply failed (triggers=$back)"; exit 1; }
echo "ROLLBACK TEST PASSED (hardening removed, then re-applied: 3 guard triggers)"
