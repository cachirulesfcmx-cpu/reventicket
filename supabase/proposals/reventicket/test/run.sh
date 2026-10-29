#!/usr/bin/env bash
# Local proof for the RevenTicket least-privilege proposal. Builds a throwaway PostgreSQL with:
#   - the Supabase role stub and VANTA EDGE migrations (as in CI),
#   - rt_owner: stand-in for Supabase's `postgres` (owns the tables, NOT superuser, BYPASSRLS,
#     member of anon/authenticated, default privileges granting ALL to client roles),
#   - the 8 legacy tables with their real structure and fictitious rows.
# Then: baseline exposure check -> migration -> regression suite -> data/VANTA unchanged ->
# rollback restores the exact original ACLs -> re-apply -> guard rejects a wrong role.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../../.."
MIG="$HERE/../20261029_reventicket_least_privilege.sql"
DOWN="$HERE/../20261029_reventicket_least_privilege_down.sql"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT="${PGPORT_TEST:-54341}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
SU=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
OWN=(psql -X -q -t -A -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U rt_owner -d postgres)
pass() { echo "PASS  $*"; }
chk() { local msg="$1"; shift; if eval "$*"; then pass "$msg"; else fail "$msg"; fi; }
fail() { echo "FAIL  $*"; exit 1; }

"${SU[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql" >/dev/null
for m in "$ROOT"/supabase/migrations/*.sql; do "${SU[@]}" -f "$m" >/dev/null 2>&1; done
"${SU[@]}" >/dev/null <<'SQL'
create role rt_owner login nosuperuser bypassrls;
grant anon, authenticated to rt_owner;
grant create, usage on schema public to rt_owner;
grant create on database postgres to rt_owner;   -- Supabase postgres can create schemas
alter default privileges for role rt_owner in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role rt_owner in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role rt_owner in schema public grant all on functions to anon, authenticated, service_role;
SQL
"${OWN[@]}" -f "$HERE/legacy_fixture.sql" >/dev/null

LEGACY="'config','events','orders','otp_codes','tickets','users','venues','zones'"
acl()   { "${SU[@]}" -c "select string_agg(c.relname||':'||pg_get_userbyid(a.grantee)||':'||a.privilege_type, ';' order by c.relname, pg_get_userbyid(a.grantee), a.privilege_type) from pg_class c, aclexplode(c.relacl) a where c.relnamespace='public'::regnamespace and c.relname in ($LEGACY)"; }
dacl()  { "${SU[@]}" -c "select coalesce(string_agg(d.defaclobjtype::text||':'||pg_get_userbyid(a.grantee)||':'||a.privilege_type, ';' order by d.defaclobjtype::text, pg_get_userbyid(a.grantee), a.privilege_type), '') from pg_default_acl d, aclexplode(d.defaclacl) a where d.defaclrole='rt_owner'::regrole"; }
data()  { "${SU[@]}" -c "select md5(string_agg(x, '|' order by x)) from (
  select 'u'||u::text x from public.users u union all select 'v'||v::text from public.venues v union all select 'e'||e::text from public.events e
  union all select 'z'||z::text from public.zones z union all select 't'||t::text from public.tickets t union all select 'o'||o::text from public.orders o
  union all select 'p'||p::text from public.otp_codes p union all select 'c'||c::text from public.config c) s"; }
vanta() { "${SU[@]}" -c "select (select string_agg(tgname, ',' order by tgname) from pg_trigger where tgname like 'vanta%')||' policies='||(select count(*) from pg_policies where tablename not in ($LEGACY))||' grants='||md5((select string_agg(c.relname||c.relacl::text, ';' order by c.relname) from pg_class c where c.relnamespace='public'::regnamespace and c.relname not in ($LEGACY) and c.relkind in ('r','v')))"; }

ACL0=$(acl); DACL0=$(dacl); DATA0=$(data); VANTA0=$(vanta)

# Baseline: today the only barrier is RLS.
chk "baseline: anon holds SELECT on users (current remote state)" '[ "$("${SU[@]}" -c "select has_table_privilege('\''anon'\'','\''public.users'\'','\''select'\'')")" = "t" ]'
leak=$("${SU[@]}" -c "begin; alter table public.users disable row level security; set local role anon; select count(*) from public.users; rollback;" | sed -n 1p)
chk "baseline: if RLS were disabled, anon could read the user row incl. password hash (risk confirmed)" '[ "$leak" = "1" ]'

# Fingerprint the target exactly as an operator would (read-only verify_remote.sql), then fill it in.
fp() { "${OWN[@]}" -f "$HERE/../verify_remote.sql" | python3 -c "import json,sys; print(json.load(sys.stdin)['fingerprint'])"; }
FP=$(fp)
FILLED="$WORK/mig_filled.sql"; sed "s/__SET_FROM_VERIFY_REMOTE__'; *$/$FP';/" "$MIG" > "$FILLED"
sed "0,/__SET_FROM_VERIFY_REMOTE__/s//00000000000000000000000000000000/" "$MIG" > "$WORK/mig_wrongfp.sql"
chmod a+r "$WORK"/*.sql
grep -q "'$FP';" "$FILLED" || fail "could not fill the fingerprint"
rejects() { # $1 = migration file, $2 = expected error tag, $3 = runner (OWN|SU)
  local -n RUN=$3
  if "${RUN[@]}" -f "$1" >/dev/null 2>"$WORK/err"; then return 1; fi
  grep -q "$2" "$WORK/err" && [ "$(acl)" = "$ACL0" ] && [ "$(dacl)" = "$DACL0" ] && [ "$("${SU[@]}" -c "select to_regnamespace('reventicket_audit') is null")" = "t" ]
}
chk "guard: unfilled fingerprint aborts, nothing changed" 'rejects "$MIG" "expected_fingerprint not set" OWN'
sed "0,/__SET_FROM_VERIFY_REMOTE__/s//${FP:0:8}…${FP: -4}/" "$MIG" > "$WORK/mig_abbrev.sql"; chmod a+r "$WORK/mig_abbrev.sql"
chk "guard: an abbreviated fingerprint (as printed in reports) aborts, nothing changed" 'rejects "$WORK/mig_abbrev.sql" "must be the full 32-character value" OWN'
chk "guard: wrong fingerprint (other database / data changed) aborts, nothing changed" 'rejects "$WORK/mig_wrongfp.sql" "fingerprint mismatch" OWN'
chk "guard: a role that does not own the tables is refused, nothing changed" 'rejects "$FILLED" "run as the owner" SU'
"${OWN[@]}" -c "create table public.session (sid varchar primary key, sess json not null, expire timestamp(6) not null)" >/dev/null
chk "guard: unexpected table in public (backend already ran: session) aborts, nothing changed" 'rejects "$FILLED" "unexpected relations in public (session)" OWN'
"${OWN[@]}" -c "drop table public.session" >/dev/null
"${OWN[@]}" -c "create policy rt_tmp on public.orders for select to anon using (true)" >/dev/null
chk "guard: a policy added after the audit aborts, nothing changed" 'rejects "$FILLED" "policies now exist" OWN'
"${OWN[@]}" -c "drop policy rt_tmp on public.orders" >/dev/null
# Atomicity: force a failure AFTER the revokes (postcondition) and confirm nothing persisted.
sed "s/if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then\n      raise exception 'RT_POSTCONDITION/X/" "$FILLED" | python3 -c "import sys; s=sys.stdin.read(); i=s.index('-- ---------------------------------------------------------------- postconditions'); print(s[:i]+\"raise exception 'RT_INJECTED_FAILURE after revokes';\n  \"+s[i:])" > "$WORK/mig_inject.sql"; chmod a+r "$WORK/mig_inject.sql"
chk "atomic: a failure after the revokes leaves ACLs, default privileges and audit schema untouched (autocommit client)" 'rejects "$WORK/mig_inject.sql" "RT_INJECTED_FAILURE" OWN'

# Apply exactly as the SQL Editor would: one request, no psql -1.
chk "migration applied as owner with the confirmed fingerprint" '"${OWN[@]}" -f "$FILLED" >/dev/null 2>&1'
recorded=$("${SU[@]}" -c "select count(*) filter (where kind='table')||'/'||count(*) filter (where kind='default') from reventicket_audit.revoked_privileges")
PER=$("${SU[@]}" -c "select case when current_setting('server_version_num')::int >= 170000 then 8 else 7 end")
chk "audit trail recorded ${recorded%/*} table privileges (8 tables x 2 roles x $PER) and ${recorded#*/} default privileges" '[ "${recorded%/*}" = "$((16 * PER))" ]'

# Regression suite.
out=$("${OWN[@]}" -f "$HERE/regression.test.sql" 2>&1) || { echo "$out"; fail "regression suite"; }
n=$(echo "$out" | grep -c "ok - " || true)
echo "$out" | grep "ok - " | sed 's/^.*ok - /  ok - /'
chk "regression suite: $n/48 assertions" '[ "$n" = "48" ]'

chk "existing rows unchanged (md5 of all legacy rows identical)" '[ "$(data)" = "$DATA0" ]'
chk "VANTA EDGE triggers, policies and grants unchanged" '[ "$(vanta)" = "$VANTA0" ]'
chk "VANTA EDGE security suite still passes (41 assertions)" '"${SU[@]}" -f "$ROOT/supabase/tests/security.test.sql" >/dev/null 2>&1'

# Rollback restores exactly what was removed.
"${OWN[@]}" -1 -f "$DOWN" >/dev/null
chk "rollback: table ACLs identical to the original" '[ "$(acl)" = "$ACL0" ]'
chk "rollback: default privileges identical to the original" '[ "$(dacl)" = "$DACL0" ]'
chk "rollback: data unchanged" '[ "$(data)" = "$DATA0" ]'
chk "rollback is idempotent (second run restores nothing extra)" '"${OWN[@]}" -1 -f "$DOWN" >/dev/null && [ "$(acl)" = "$ACL0" ]'

# Re-apply, then make later changes the rollback must not touch or extend.
"${OWN[@]}" -f "$FILLED" >/dev/null 2>&1
chk "re-apply after rollback works" '[ "$("${SU[@]}" -c "select has_table_privilege('\''anon'\'','\''public.users'\'','\''select'\'')")" = "f" ]'
"${OWN[@]}" -c "create table public.later_private (id int primary key)" >/dev/null           # created while private-by-default
"${OWN[@]}" -c "revoke all on public.zones from service_role" >/dev/null                      # a later, unrelated hardening
"${OWN[@]}" -1 -f "$DOWN" >/dev/null
chk "rollback grants nothing on objects it did not touch (later table stays private)" '[ "$("${SU[@]}" -c "select has_table_privilege('\''anon'\'','\''public.later_private'\'','\''select'\'')")" = "f" ]'
chk "rollback does not undo later unrelated changes (service_role revoke on zones kept)" '[ "$("${SU[@]}" -c "select has_table_privilege('\''service_role'\'','\''public.zones'\'','\''select'\'')")" = "f" ]'
chk "rollback restores exactly the recorded client privileges" '[ "$("${SU[@]}" -c "select has_table_privilege('\''anon'\'','\''public.users'\'','\''select'\'') and has_table_privilege('\''authenticated'\'','\''public.orders'\'','\''truncate'\'')")" = "t" ]'

"${OWN[@]}" -c "drop table public.later_private" >/dev/null
"${OWN[@]}" -f "$FILLED" >/dev/null 2>&1
state=$("${OWN[@]}" -f "$HERE/../verify_remote.sql")
chk "verify_remote.sql runs read-only and reports no client access after apply" 'echo "$state" | python3 -c "import json,sys; d=json.load(sys.stdin); p=d[\"client_privileges_on_legacy\"]; assert all(not v[\"anon\"] and not v[\"authenticated\"] and v[\"rls\"] for v in p.values()); assert d[\"legacy_policies\"]==0; assert d[\"vanta\"][\"anon_odds\"] is False"'

echo "REVENTICKET LEAST-PRIVILEGE PROPOSAL: ALL LOCAL CHECKS PASSED on $("${SU[@]}" -c "show server_version")"
