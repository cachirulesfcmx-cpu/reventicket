#!/usr/bin/env bash
# Before/after validation of the three RevenTicket credential patches against the REAL backend bundle.
#   Usage: bash validate.sh /path/to/reventicket-main-checkout   (npm ci done; bcrypt built; clean git tree)
# Builds dist/index.cjs twice (unpatched, patched) and runs each against a throwaway local PostgreSQL with the full
# shared/schema.ts (drizzle-kit push) and fictitious data. Never point it at a real database.
set -euo pipefail
RT_DIR="$(cd "${1:?path to a RevenTicket main checkout}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)
WORK=$(mktemp -d); [ "$(id -u)" = "0" ] && chown -R postgres "$WORK"
PID=""
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null; (cd "$RT_DIR" && git checkout -q -- . && npm run -s build:server >/dev/null 2>&1) || true
  "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p 55501 -k $WORK -c listen_addresses=127.0.0.1" -l "$WORK/log" -w start >/dev/null
DB=postgres://postgres@127.0.0.1:55501/postgres
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1 "$DB")

(cd "$RT_DIR" && git diff --quiet) || { echo "checkout has local changes; aborting"; exit 1; }
(cd "$RT_DIR" && DATABASE_URL=$DB timeout 180 npx drizzle-kit push --force </dev/null >"$WORK/push.log" 2>&1)
# connect-pg-simple's table (its createTableIfMissing cannot find table.sql inside the bundle; see findings)
"${PSQL[@]}" -c 'create table "session" ("sid" varchar not null primary key, "sess" json not null, "expire" timestamp(6) not null)' >/dev/null
ADMIN_PASS="T$(openssl rand -hex 12)!"
HASH=$(cd "$RT_DIR" && node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" "$ADMIN_PASS")
"${PSQL[@]}" -c "insert into users (id, email, password, first_name, last_name, role) values ('u-admin', 'admin@example.test', '$HASH', 'Admin', 'Fixture', 'admin')" >/dev/null
PEPPER=$(openssl rand -hex 32)

run() { # $1 label
  local label=$1 port=56501
  (cd "$RT_DIR" && npm run -s build:server >/dev/null 2>&1)
  (cd "$RT_DIR" && NODE_ENV=production PORT=$port DATABASE_URL=$DB SESSION_SECRET="$(openssl rand -hex 32)" JWT_SECRET="$(openssl rand -hex 32)" \
     OTP_PEPPER="$PEPPER" ADMIN_PASSWORD="plaintext-bypass-test" WHATSAPP_ENABLED=false JOBS_ENABLED=false exec node dist/index.cjs >"$WORK/$label.log" 2>&1) &
  PID=$!
  for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && break; sleep 1; done
  BASE="http://127.0.0.1:$port" DB="$DB" ADMIN_PASS="$ADMIN_PASS" PEPPER="$PEPPER" LABEL="$label" RT_DIR="$RT_DIR" node "$HERE/validate.mjs"
  kill "$PID"; wait "$PID" 2>/dev/null || true; PID=""
  "${PSQL[@]}" -c "delete from users where id <> 'u-admin'; delete from otp_codes; delete from session" >/dev/null
}
run before
(cd "$RT_DIR" && git apply "$HERE"/0*.patch)
run after
