#!/usr/bin/env bash
# Spins up a throwaway PostgreSQL cluster, applies the platform stub + every migration
# in order, then runs the RLS / security test suite. Exits non-zero on any failure.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -X -q -t -o /dev/null -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/supabase_stub.sql"
for m in "$HERE"/../migrations/*.sql; do
  echo "migrate: $(basename "$m")"
  "${PSQL[@]}" -f "$m"
done
for t in "$HERE"/*.test.sql; do
  echo "test: $(basename "$t")"
  "${PSQL[@]}" -f "$t"
done
echo "SQL TESTS PASSED"
