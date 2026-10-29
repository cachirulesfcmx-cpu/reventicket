-- RevenTicket · least privilege for the legacy tables (PROPOSAL — not applied).
-- Target: the database the RevenTicket backend really uses, confirmed by the user. Never MelatePro.
-- Run as the role that owns the tables AND that the backend connects as (Supabase: `postgres`).
--
-- What it does
--   A. Revokes every table privilege that anon/authenticated hold on the 8 legacy tables.
--      The backend never uses Supabase REST/supabase-js; it reaches these tables only through
--      Drizzle/pg with DATABASE_URL as the owner role (BYPASSRLS), which keeps full access.
--   B. Stops future tables/sequences created by this role in `public` from being granted to
--      anon/authenticated automatically. The backend creates `session` (connect-pg-simple),
--      `push_subscriptions`, `discount_codes`, `event_maps` and, via `drizzle-kit push`, the rest of
--      shared/schema.ts, all WITHOUT RLS; with Supabase's defaults they would be public via REST.
--   Every privilege removed is recorded in reventicket_audit.revoked_privileges so the rollback
--   restores exactly what this migration took away, and nothing else.
--
-- Safety
--   * The whole migration is ONE statement: atomic under any client (SQL Editor, apply_migration,
--     psql with or without -1). Any failed check raises and PostgreSQL rolls everything back.
--   * Destination guard: paste the `fingerprint` reported by verify_remote.sql (read-only) on the
--     target into expected_fingerprint. A missing or different fingerprint aborts.
--   * Aborts on unexpected state: wrong role, RLS off, policies present, unknown tables in `public`
--     (e.g. `session` exists = the backend already ran here; re-audit first), previous active run.
--
-- What it does NOT do: no data changes, no RLS changes (stays enabled, still no policies),
-- no changes to postgres/service_role privileges, to VANTA EDGE objects, or to any other schema.

do $migration$
declare
  -- >>> Fill in from verify_remote.sql run on the confirmed production target. <<<
  expected_fingerprint constant text := '__SET_FROM_VERIFY_REMOTE__';

  legacy constant text[] := array['config','events','orders','otp_codes','tickets','users','venues','zones'];
  vanta constant text[] := array['teams','games','game_facts','odds_snapshots','model_versions','predictions',
                                 'followed_teams','user_preferences','profiles','data_sources','ingestion_runs'];
  privs constant text := 'select,insert,update,delete,truncate,references,trigger'
    || case when current_setting('server_version_num')::int >= 170000 then ',maintain' else '' end;
  t text;
  actual_fingerprint text;
  unexpected text;
  active boolean;
begin
  -- ---------------------------------------------------------------- preconditions (abort = no change)
  if not exists (select 1 from pg_roles where rolname = 'anon') or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'RT_PRECONDITION: Supabase client roles not found; wrong database';
  end if;
  foreach t in array legacy loop
    if to_regclass('public.' || t) is null then
      raise exception 'RT_PRECONDITION: table public.% not found', t;
    end if;
    if pg_get_userbyid((select relowner from pg_class where oid = ('public.' || t)::regclass)) <> current_user then
      raise exception 'RT_PRECONDITION: run as the owner of public.% (current_user=%)', t, current_user;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RT_PRECONDITION: RLS is not enabled on public.%; stop and review', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = any(legacy)) then
    raise exception 'RT_PRECONDITION: policies now exist on legacy tables; re-audit before applying';
  end if;
  select string_agg(c.relname, ', ' order by c.relname) into unexpected
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.relname <> all(legacy) and c.relname <> all(vanta)
    and c.relname not in ('data_freshness', 'published_performance');
  if unexpected is not null then
    raise exception 'RT_PRECONDITION: unexpected relations in public (%); the backend may already run here. Re-audit first', unexpected;
  end if;

  execute $q$
    select md5(coalesce(string_agg(x, ',' order by x), ''))
    from (select 'config:' || id as x from public.config union all select 'events:' || id from public.events
          union all select 'orders:' || id from public.orders union all select 'otp_codes:' || id from public.otp_codes
          union all select 'tickets:' || id from public.tickets union all select 'users:' || id from public.users
          union all select 'venues:' || id from public.venues union all select 'zones:' || id from public.zones) s
  $q$ into actual_fingerprint;
  if expected_fingerprint = '__SET_FROM_VERIFY_REMOTE__' then
    raise exception 'RT_PRECONDITION: expected_fingerprint not set; run verify_remote.sql on the confirmed target first';
  end if;
  -- The full 32-hex md5 is compared; an abbreviated value from a report (e.g. "6b64e073…7995") is rejected.
  if expected_fingerprint !~ '^[0-9a-f]{32}$' then
    raise exception 'RT_PRECONDITION: expected_fingerprint must be the full 32-character value from verify_remote.sql';
  end if;
  if actual_fingerprint <> expected_fingerprint then
    raise exception 'RT_PRECONDITION: fingerprint mismatch (expected %, found %); wrong database or data changed since the check',
      expected_fingerprint, actual_fingerprint;
  end if;

  if to_regclass('reventicket_audit.revoked_privileges') is not null then
    execute 'select exists (select 1 from reventicket_audit.revoked_privileges where restored_at is null)' into active;
    if active then
      raise exception 'RT_PRECONDITION: a previous run is still recorded as active; nothing to do';
    end if;
  end if;

  -- ---------------------------------------------------------------- private bookkeeping (no client access)
  create schema if not exists reventicket_audit;
  revoke all on schema reventicket_audit from public, anon, authenticated;
  create table if not exists reventicket_audit.revoked_privileges (
    id bigint generated always as identity primary key,
    kind text not null check (kind in ('table', 'default')),
    object_name text not null,          -- table name, or default-ACL object type ('r' tables, 'S' sequences)
    grantee text not null,
    privilege text not null,
    revoked_at timestamptz not null default now(),
    restored_at timestamptz
  );
  revoke all on reventicket_audit.revoked_privileges from public, anon, authenticated;

  -- Snapshot exactly what is about to be removed.
  insert into reventicket_audit.revoked_privileges (kind, object_name, grantee, privilege)
  select 'table', c.relname, pg_get_userbyid(a.grantee), a.privilege_type
  from pg_class c, aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace and c.relname = any(legacy)
    and a.grantee in ('anon'::regrole, 'authenticated'::regrole);

  insert into reventicket_audit.revoked_privileges (kind, object_name, grantee, privilege)
  select 'default', d.defaclobjtype::text, pg_get_userbyid(a.grantee), a.privilege_type
  from pg_default_acl d, aclexplode(d.defaclacl) a
  where d.defaclrole = current_user::regrole and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype in ('r', 'S') and a.grantee in ('anon'::regrole, 'authenticated'::regrole);

  -- ---------------------------------------------------------------- A. legacy tables: no client privileges
  revoke all on table public.config, public.events, public.orders, public.otp_codes,
                      public.tickets, public.users, public.venues, public.zones
    from anon, authenticated;

  -- ---------------------------------------------------------------- B. future objects private by default
  alter default privileges in schema public revoke all on tables from anon, authenticated;
  alter default privileges in schema public revoke all on sequences from anon, authenticated;

  -- ---------------------------------------------------------------- postconditions (fail = full rollback)
  foreach t in array legacy loop
    if has_table_privilege('anon', 'public.' || t, privs) or has_table_privilege('authenticated', 'public.' || t, privs) then
      raise exception 'RT_POSTCONDITION: client role still has privileges on public.%', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RT_POSTCONDITION: RLS disabled on public.%', t;
    end if;
  end loop;
  if exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
             where d.defaclrole = current_user::regrole and d.defaclnamespace = 'public'::regnamespace
               and d.defaclobjtype in ('r', 'S') and a.grantee in ('anon'::regrole, 'authenticated'::regrole)) then
    raise exception 'RT_POSTCONDITION: default privileges still grant client roles';
  end if;

  raise notice 'RT_APPLIED: % table and % default privileges revoked and recorded',
    (select count(*) from reventicket_audit.revoked_privileges where kind = 'table' and restored_at is null),
    (select count(*) from reventicket_audit.revoked_privileges where kind = 'default' and restored_at is null);
end
$migration$;
