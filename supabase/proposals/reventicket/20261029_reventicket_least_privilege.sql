-- RevenTicket · least privilege for the legacy tables (PROPOSAL — not applied).
-- Target: Supabase project reventicket (jxdyrzbeykhswpndoing). Never run against MelatePro.
-- Run as the role that owns the tables (Supabase: `postgres`, which is what DATABASE_URL uses).
--
-- What it does
--   A. Revokes every table privilege that anon/authenticated hold on the 8 legacy tables.
--      RevenTicket never uses Supabase REST/supabase-js: all access goes through Drizzle with
--      DATABASE_URL (role postgres = owner, BYPASSRLS), which keeps full access.
--   B. Stops future tables/sequences created by this role in `public` from being granted to
--      anon/authenticated automatically (RevenTicket creates `session`, `discount_codes`,
--      `event_maps` at runtime WITHOUT enabling RLS; they would otherwise be fully public via REST).
--   Every privilege removed is recorded in reventicket_audit.revoked_privileges so the rollback
--   restores exactly what this migration took away, and nothing else.
--
-- What it does NOT do: no data changes, no RLS changes (stays enabled, still no policies),
-- no changes to service_role, to VANTA EDGE objects, or to any other table.

do $guard$
declare
  legacy constant text[] := array['config','events','orders','otp_codes','tickets','users','venues','zones'];
  t text;
  active boolean;
begin
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
  if to_regclass('reventicket_audit.revoked_privileges') is not null then
    execute 'select exists (select 1 from reventicket_audit.revoked_privileges where restored_at is null)' into active;
    if active then
      raise exception 'RT_PRECONDITION: a previous run is still recorded as active; nothing to do';
    end if;
  end if;
end
$guard$;

-- Private bookkeeping (not in an API-exposed schema; no client access).
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
from pg_class c
join pg_namespace n on n.oid = c.relnamespace,
     aclexplode(c.relacl) a
where n.nspname = 'public'
  and c.relname = any(array['config','events','orders','otp_codes','tickets','users','venues','zones'])
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole);

insert into reventicket_audit.revoked_privileges (kind, object_name, grantee, privilege)
select 'default', d.defaclobjtype::text, pg_get_userbyid(a.grantee), a.privilege_type
from pg_default_acl d, aclexplode(d.defaclacl) a
where d.defaclrole = current_user::regrole
  and d.defaclnamespace = 'public'::regnamespace
  and d.defaclobjtype in ('r', 'S')
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole);

-- A. Legacy tables: no client privileges at all.
revoke all on table public.config, public.events, public.orders, public.otp_codes,
                    public.tickets, public.users, public.venues, public.zones
  from anon, authenticated;

-- B. Future tables/sequences created by this role in public are private by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Post-conditions: fail (and roll back the whole migration) if anything is still exposed.
do $post$
declare
  t text;
  -- PostgreSQL 17 added MAINTAIN (the `m` in arwdDxtm); include it when the server knows it.
  privs constant text := 'select,insert,update,delete,truncate,references,trigger'
    || case when current_setting('server_version_num')::int >= 170000 then ',maintain' else '' end;
begin
  foreach t in array array['config','events','orders','otp_codes','tickets','users','venues','zones'] loop
    if has_table_privilege('anon', 'public.' || t, privs) or has_table_privilege('authenticated', 'public.' || t, privs) then
      raise exception 'RT_POSTCONDITION: client role still has privileges on public.%', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RT_POSTCONDITION: RLS disabled on public.%', t;
    end if;
  end loop;
end
$post$;
