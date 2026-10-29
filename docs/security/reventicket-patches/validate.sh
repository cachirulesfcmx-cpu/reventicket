#!/usr/bin/env bash
# Security regression suite for the RevenTicket backend: runs the SAME probes against two builds of the real
# server (node dist/index.cjs) and prints them side by side.
#   Usage: bash validate.sh <before-checkout> <after-checkout>
#   Each checkout needs `npm ci`, `npm rebuild bcrypt` and `npm run build:server` done. Neither is modified.
# Each build gets its own throwaway local PostgreSQL with the full shared/schema.ts (drizzle-kit push into an EMPTY
# database), fictitious rows and random secrets. Never point this at a real or shared database.
set -euo pipefail
BEFORE="$(cd "${1:?before checkout}" && pwd)"; AFTER="$(cd "${2:?after checkout}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
OUT="${VALIDATE_OUT:-$(mktemp -d)}"; mkdir -p "$OUT"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)
WORKS=(); PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  for w in "${WORKS[@]}"; do "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$w/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$w"; done; }
trap cleanup EXIT

run() { # $1 label, $2 checkout, $3 pg port
  local label=$1 dir=$2 port=$3 work; work=$(mktemp -d); WORKS+=("$work"); [ "$(id -u)" = "0" ] && chown -R postgres "$work"
  "${RUNAS[@]}" "$PGBIN/initdb" -D "$work/data" -A trust -U postgres >/dev/null
  "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=127.0.0.1" -l "$work/log" -w start >/dev/null
  local db="postgres://postgres@127.0.0.1:$port/postgres"; local psql=(psql -X -q -t -A -v ON_ERROR_STOP=1 "$db")
  (cd "$dir" && DATABASE_URL=$db timeout 180 npx drizzle-kit push --force </dev/null >"$OUT/$label.push.log" 2>&1)
  # connect-pg-simple cannot create it from the bundle (ENOENT dist/table.sql; see REVENTICKET_APP_FINDINGS.md)
  "${psql[@]}" -c 'create table "session" ("sid" varchar not null primary key, "sess" json not null, "expire" timestamp(6) not null)' >/dev/null
  local admin_pass pepper hash; admin_pass="T$(openssl rand -hex 12)!"; pepper=$(openssl rand -hex 32)
  hash=$(cd "$dir" && node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" "$admin_pass")
  "${psql[@]}" >/dev/null <<SQL
insert into users (id, email, password, first_name, last_name, role) values ('u-admin', 'admin@example.test', '$hash', 'Admin', 'Fixture', 'admin');
insert into venues (id, name, city) values ('v1', 'Foro A', 'CDMX');
insert into events (id, title, category, date, venue_id) values ('e1', 'Evento 1', 'concierto', now() + interval '10 days', 'v1');
SQL
  local app=$((port + 1000))
  (cd "$dir" && NODE_ENV=production PORT=$app DATABASE_URL=$db SESSION_SECRET="$(openssl rand -hex 32)" JWT_SECRET="$(openssl rand -hex 32)" \
     OTP_PEPPER="$pepper" ADMIN_PASSWORD="plaintext-bypass-test" WHATSAPP_ENABLED=false JOBS_ENABLED=false \
     exec node dist/index.cjs >"$OUT/$label.server.log" 2>&1) &
  local pid=$!; PIDS+=("$pid")
  for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$app/api/health" >/dev/null 2>&1 && break; sleep 1; done
  BASE="http://127.0.0.1:$app" DB="$db" ADMIN_PASS="$admin_pass" PEPPER="$pepper" LABEL="$label" RT_DIR="$dir" \
    node "$HERE/validate.mjs" > "$OUT/$label.json"
  kill "$pid"; wait "$pid" 2>/dev/null || true
}
run before "$BEFORE" 55701
run after "$AFTER" 55702

python3 - "$OUT" <<'PY'
import json, sys, pathlib
out = pathlib.Path(sys.argv[1])
b = json.loads((out / "before.json").read_text()); a = json.loads((out / "after.json").read_text())
expect = json.loads((out / "after.json").read_text())["_expect"]
ok = True
print(f"{'check':58s} {'before':26s} {'after':26s} verdict")
for k in [k for k in a if not k.startswith('_')]:
    want = expect.get(k)
    passed = want is None or str(a[k]) == str(want)
    ok &= passed
    print(f"{k:58s} {str(b.get(k)):26.26s} {str(a[k]):26.26s} {'OK' if passed else 'FAIL (want ' + str(want) + ')'}")
for side in ("before", "after"):
    log = (out / f"{side}.server.log").read_text()
    leaks = [s for s in ("plaintext-bypass-test", "Smoke-Only-") if s in log]
    print(f"server log {side}: secrets/passwords echoed: {leaks or 'none'}")
    ok &= not leaks
print("SECURITY REGRESSION: " + ("PASS" if ok else "FAIL"))
sys.exit(0 if ok else 1)
PY
