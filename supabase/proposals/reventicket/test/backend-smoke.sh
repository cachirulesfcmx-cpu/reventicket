#!/usr/bin/env bash
# A/B smoke test of the REAL RevenTicket backend with and without the least-privilege migration.
#   Usage: bash backend-smoke.sh /path/to/reventicket-main-checkout   (npm ci + npm run build:server done there; bcrypt built)
#   The server runs the same bundle Railway starts (`node dist/index.cjs`).
# Four throwaway local databases (never a remote one):
#   mirror-A / mirror-B : schema identical to the remote project (8 legacy tables), without / with migration
#   full-A   / full-B   : same, plus `drizzle-kit push` of shared/schema.ts (as the backend role), without / with
# The backend runs in production API mode as rt_owner (stand-in for Supabase `postgres`), WhatsApp and jobs off,
# random throwaway secrets. Every endpoint result must be identical between A and B, the server log must have
# no "permission denied", and tables the backend creates at runtime must not be exposed to anon/authenticated.
set -euo pipefail
RT_DIR="$(cd "${1:?path to a RevenTicket main checkout}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../../../.."
MIG="$HERE/../20261029_reventicket_least_privilege.sql"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
OUT="${SMOKE_OUT:-$(mktemp -d)}"; mkdir -p "$OUT"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)

run_scenario() { # $1 name, $2 apply migration (0/1), $3 full schema (0/1), $4 port
  local name=$1 apply=$2 full=$3 port=$4 work; work=$(mktemp -d); [ "$(id -u)" = "0" ] && chown -R postgres "$work"
  "${RUNAS[@]}" "$PGBIN/initdb" -D "$work/data" -A trust -U postgres >/dev/null
  "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=127.0.0.1" -l "$work/log" -w start >/dev/null
  local SU=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres -d postgres)
  local OWN=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U rt_owner -d postgres)
  "${SU[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql" >/dev/null
  vanta_migrations() { for m in "$ROOT"/supabase/migrations/*.sql; do "${SU[@]}" -f "$m" >/dev/null 2>&1; done; }
  # mirror: VANTA first (as on the remote). full: RevenTicket schema first, because drizzle-kit push offers to
  # RENAME the VANTA tables into RevenTicket ones when they share `public` (see the risk section of the plan).
  [ "$full" = 0 ] && vanta_migrations
  "${SU[@]}" >/dev/null <<'SQL'
create role rt_owner login nosuperuser bypassrls;
grant anon, authenticated to rt_owner;
grant create, usage on schema public to rt_owner;
grant create on database postgres to rt_owner;
alter default privileges for role rt_owner in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role rt_owner in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role rt_owner in schema public grant all on functions to anon, authenticated, service_role;
SQL
  local dburl="postgres://rt_owner@127.0.0.1:$port/postgres"
  if [ "$full" = 1 ]; then
    # Full shared/schema.ts created by the backend role on an empty database (no rename prompts), then fictitious rows.
    (cd "$RT_DIR" && DATABASE_URL="$dburl" timeout 180 npx drizzle-kit push --force >"$OUT/$name.push.log" 2>&1 </dev/null) || { echo "drizzle push failed ($name)"; tail -5 "$OUT/$name.push.log"; }
    vanta_migrations
    "${OWN[@]}" >/dev/null <<'SQL'
alter table public.users enable row level security; alter table public.venues enable row level security;
alter table public.events enable row level security; alter table public.zones enable row level security;
alter table public.tickets enable row level security; alter table public.orders enable row level security;
alter table public.otp_codes enable row level security; alter table public.config enable row level security;
insert into public.users (id, email, password, first_name, last_name, role) values ('u-admin', 'admin@example.test', 'x', 'Admin', 'Fixture', 'admin');
insert into public.venues (id, name, city) values ('v1', 'Foro A', 'CDMX'), ('v2', 'Foro B', 'GDL'), ('v3', 'Foro C', 'MTY');
insert into public.events (id, title, category, date, venue_id) values
  ('e1', 'Evento 1', 'concierto', now() + interval '10 days', 'v1'), ('e2', 'Evento 2', 'deporte', now() + interval '20 days', 'v2'),
  ('e3', 'Evento 3', 'teatro', now() + interval '30 days', 'v3');
SQL
  else
    "${OWN[@]}" -f "$HERE/legacy_fixture.sql" >/dev/null
  fi
  local admin_pass hash; admin_pass="T$(openssl rand -hex 12)!"
  hash=$(cd "$RT_DIR" && node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" "$admin_pass")
  "${OWN[@]}" -c "update public.users set password = '$hash' where id = 'u-admin'" >/dev/null
  if [ "$apply" = 1 ]; then
    local fp; fp=$("${OWN[@]}" -f "$HERE/../verify_remote.sql" | python3 -c "import json,sys; print(json.load(sys.stdin)['fingerprint'])")
    sed "s/__SET_FROM_VERIFY_REMOTE__'; *$/$fp';/" "$MIG" > "$work/mig.sql"
    if [ "$full" = 1 ]; then
      # TEST-ONLY variant: the real migration refuses databases with tables outside the audited scope (by design).
      python3 - "$work/mig.sql" <<'PY'
import sys; p = sys.argv[1]; s = open(p).read()
a = s.index("  if unexpected is not null then"); b = s.index("end if;", a) + len("end if;")
open(p, "w").write(s[:a] + "  -- unexpected-relations guard disabled for the full-schema smoke test only" + s[b:])
PY
    fi
    chmod a+r "$work/mig.sql"
    "${OWN[@]}" -f "$work/mig.sql" >"$OUT/$name.migration.log" 2>&1 || { echo "migration failed ($name)"; cat "$OUT/$name.migration.log"; }
  fi
  local app_port=$((port + 1000))
  (cd "$RT_DIR" && NODE_ENV=production PORT=$app_port DATABASE_URL="$dburl" SESSION_SECRET="$(openssl rand -hex 32)" \
     JWT_SECRET="$(openssl rand -hex 32)" WHATSAPP_ENABLED=false JOBS_ENABLED=false WALLET_ENABLED=true ANALYTICS_ENABLED=true \
     FRONTEND_URL=http://localhost exec node dist/index.cjs >"$OUT/$name.server.log" 2>&1) &
  local pid=$!
  for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$app_port/api/health" >/dev/null 2>&1 && break; sleep 1; done
  BASE="http://127.0.0.1:$app_port" SMOKE_DB_URL="postgres://postgres@127.0.0.1:$port/postgres" ADMIN_EMAIL=admin@example.test \
    ADMIN_PASS="$admin_pass" RT_DIR="$RT_DIR" node "$HERE/smoke.mjs" > "$OUT/$name.json" || echo '{}' > "$OUT/$name.json"
  kill "$pid" 2>/dev/null || true; pkill -f "PORT=$app_port" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  "${SU[@]}" -c "select coalesce(json_object_agg(c.relname, has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')), '{}')
                 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
                 and pg_get_userbyid(c.relowner) = 'rt_owner'" > "$OUT/$name.exposure.json"
  "${SU[@]}" -c "select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and pg_get_userbyid(c.relowner)='rt_owner'" > "$OUT/$name.tables"
  "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$work/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$work"
}

run_scenario mirror-A 0 0 55401
run_scenario mirror-B 1 0 55402
run_scenario full-A 0 1 55403
run_scenario full-B 1 1 55404

python3 - "$OUT" <<'PY'
import json, sys, pathlib
out = pathlib.Path(sys.argv[1]); ok = True
for schema in ("mirror", "full"):
    a = json.loads((out / f"{schema}-A.json").read_text()); b = json.loads((out / f"{schema}-B.json").read_text())
    ea = json.loads((out / f"{schema}-A.exposure.json").read_text()); eb = json.loads((out / f"{schema}-B.exposure.json").read_text())
    print(f"\n== {schema} schema ({(out / f'{schema}-B.tables').read_text().strip()} backend-owned tables) — step: without migration | with migration")
    for k in a:
        same = a.get(k) == b.get(k); ok &= same
        print(f"  {'=' if same else '≠'} {k:28s} {a.get(k)!s:45.45s} | {b.get(k)}")
    exposedA = sorted(t for t, v in ea.items() if v); exposedB = sorted(t for t, v in eb.items() if v)
    print(f"  tables readable by anon/authenticated without migration: {len(exposedA)} {exposedA}")
    print(f"  tables readable by anon/authenticated with migration:    {len(exposedB)} {exposedB}")
    legacy = {'config','events','orders','otp_codes','tickets','users','venues','zones'}
    if schema == "mirror":
        ok &= not exposedB            # remote-identical schema: nothing may stay exposed
    else:
        ok &= not (set(exposedB) & legacy)
        if exposedB:
            print(f"  NOTE: {len(exposedB)} tables created BEFORE the migration and outside its audited scope stay exposed;")
            print("        the real migration refuses such a database (unexpected-relations guard) until the scope is re-audited.")
    for side in "AB":
        log = (out / f"{schema}-{side}.server.log").read_text()
        denied = log.count("permission denied")
        print(f"  server log {side}: 'permission denied' x{denied}"); ok &= denied == 0
print("\nBACKEND SMOKE A/B: " + ("IDENTICAL BEHAVIOUR; NOTHING IN SCOPE EXPOSED" if ok else "DIFFERENCES FOUND"))
sys.exit(0 if ok else 1)
PY
