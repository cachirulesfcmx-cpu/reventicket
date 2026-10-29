#!/usr/bin/env bash
# Identify the database the RevenTicket production backend uses — WITHOUT printing DATABASE_URL or its password.
#
# Run it with the production service's own environment, from a RevenTicket checkout of this branch:
#   railway login && railway link            # choose the RevenTicket project and its backend service
#   railway run -- bash supabase/proposals/reventicket/operator/identify_production_db.sh
# (`railway run` injects the service variables into this process only; nothing is written to disk.)
#
# Output: host, port, database name, user, whether a password is present (yes/no), and the read-only
# verify_remote.sql report (privileges, row COUNTS and an md5 fingerprint of row ids; no row contents).
# Share that output. Do not share DATABASE_URL, the password or screenshots of the variables page.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in this environment."
  echo "If the Railway service no longer exists (the API answers 404 'Application not found'), report that:"
  echo "it means there is no running production backend and therefore no confirmed production database."
  exit 2
fi

python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlsplit(os.environ["DATABASE_URL"])
print("host:          ", u.hostname)
print("port:          ", u.port or 5432)
print("database:      ", (u.path or "/").lstrip("/") or "(default)")
print("user:          ", urllib.parse.unquote(u.username or ""))
print("password set:  ", "yes" if u.password else "no")
host = u.hostname or ""
ref = None
if host.endswith(".supabase.co") and host.startswith("db."):
    ref = host.split(".")[1]
elif "pooler.supabase.com" in host and u.username and "." in u.username:
    ref = urllib.parse.unquote(u.username).split(".", 1)[1]
print("supabase ref:  ", ref or "(not a Supabase host)")
PY

command -v psql >/dev/null || { echo "psql not found: install the PostgreSQL client to run the read-only report"; exit 3; }
# Each report runs inside BEGIN READ ONLY ... ROLLBACK (any write would fail). An explicit transaction is used
# instead of PGOPTIONS because the Supabase transaction pooler may reject startup options.
ro() { psql "$DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 \
         -c "begin transaction read only; set local statement_timeout = '30s';" -f "$1" -c "rollback"; }
echo "--- identify.sql (read-only) ---"
ident=$(ro "$HERE/identify.sql")
echo "$ident"
# The full report needs Supabase roles and the 8 legacy tables; otherwise it is not this plan's target.
if echo "$ident" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d['is_supabase'] and len(d['reventicket_legacy_tables_present']) == 8 else 1)"; then
  echo "--- verify_remote.sql (read-only) ---"
  ro "$HERE/../verify_remote.sql"
else
  echo "--- verify_remote.sql skipped: not a Supabase database with the 8 RevenTicket legacy tables."
  echo "    The least-privilege plan does not apply as written; a new audit of this database is required."
fi
