-- RevenTicket · Plan B: move to a dedicated schema (PROPOSAL — not applied).
-- Moves the 8 legacy tables WITH their rows from `public` to `reventicket`, owned by the dedicated login role
-- `reventicket_app` (not a Supabase client role, no BYPASSRLS, no membership in anon/authenticated), aligns the
-- schema with shared/schema.ts, creates connect-pg-simple's `session` table, and records the original state in
-- reventicket_audit.schema_move so 20261029_reventicket_move_to_own_schema_down.sql can restore it exactly.
--
-- ONE `DO` statement: atomic under any client (SQL Editor, apply_migration, psql). Any failed check raises and
-- PostgreSQL rolls everything back. Run as `postgres` on the CONFIRMED RevenTicket database only, with the app
-- stopped or in maintenance (no writes during the move).
--
-- Before running: create the login role out of band so no password is ever written in files or logs (Supabase
-- dashboard, or a one-off statement with a generated password stored only in Railway), with no other attributes:
--   create role reventicket_app login noinherit nocreatedb nocreaterole nobypassrls password '<generated>';
-- Then paste the FULL fingerprint from verify_remote.sql below. After running: point Railway's DATABASE_URL at
-- reventicket_app (pooler user `reventicket_app.<project-ref>`), deploy the app with 0005, then the post-checks.
do $move$
declare
  -- >>> Fill in with the full 32-character `fingerprint` from verify_remote.sql on the confirmed target. <<<
  expected_fingerprint constant text := '__SET_FROM_VERIFY_REMOTE__';
  legacy constant text[] := array['users','venues','events','zones','tickets','orders','otp_codes','config'];
  actual text;
  t text;
  r record;
  had_is_featured boolean;
begin
  -- ---------------------------------------------------------------- preconditions (abort = no change)
  if not exists (select 1 from pg_roles where rolname = 'reventicket_app' and rolcanlogin and not rolsuper and not rolbypassrls
                 and not rolcreaterole and not rolcreatedb) then
    raise exception 'RT_MOVE: create the login role reventicket_app first (login, no superuser/bypassrls/createrole/createdb)';
  end if;
  if exists (select 1 from pg_auth_members m where m.member = 'reventicket_app'::regrole) then
    raise exception 'RT_MOVE: reventicket_app must not be a member of other roles (e.g. anon/authenticated)';
  end if;
  if to_regnamespace('reventicket') is not null then
    raise exception 'RT_MOVE: schema reventicket already exists; review before re-running';
  end if;
  foreach t in array legacy loop
    if to_regclass('public.' || t) is null then raise exception 'RT_MOVE: public.% not found', t; end if;
    if pg_get_userbyid((select relowner from pg_class where oid = ('public.' || t)::regclass)) <> current_user then
      raise exception 'RT_MOVE: run as the owner of public.% (current_user=%)', t, current_user;
    end if;
  end loop;
  if exists (select 1 from pg_constraint k where k.contype = 'f'
               and k.confrelid in (select ('public.' || x)::regclass from unnest(legacy) x)
               and k.conrelid not in (select ('public.' || x)::regclass from unnest(legacy) x)) then
    raise exception 'RT_MOVE: a table outside RevenTicket references a legacy table; re-audit';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = any(legacy))
     or exists (select 1 from pg_trigger g where not g.tgisinternal and g.tgrelid in (select ('public.' || x)::regclass from unnest(legacy) x)) then
    raise exception 'RT_MOVE: policies or triggers now exist on legacy tables; re-audit';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'otp_codes' and column_name = 'used')
     or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'otp_codes' and column_name = 'verified') then
    raise exception 'RT_MOVE: otp_codes columns differ from the audited state (used / verified); re-audit';
  end if;
  execute $q$
    select md5(coalesce(string_agg(x, ',' order by x), ''))
    from (select 'config:' || id as x from public.config union all select 'events:' || id from public.events
          union all select 'orders:' || id from public.orders union all select 'otp_codes:' || id from public.otp_codes
          union all select 'tickets:' || id from public.tickets union all select 'users:' || id from public.users
          union all select 'venues:' || id from public.venues union all select 'zones:' || id from public.zones) s
  $q$ into actual;
  if expected_fingerprint !~ '^[0-9a-f]{32}$' then
    raise exception 'RT_MOVE: expected_fingerprint must be the full 32-character value from verify_remote.sql';
  end if;
  if actual <> expected_fingerprint then
    raise exception 'RT_MOVE: fingerprint mismatch (expected %, found %); wrong database or data changed', expected_fingerprint, actual;
  end if;

  -- ---------------------------------------------------------------- record the original state (for the rollback)
  create schema if not exists reventicket_audit;
  revoke all on schema reventicket_audit from public, anon, authenticated;
  create table if not exists reventicket_audit.schema_move (
    table_name text primary key,
    original_owner text not null,
    original_acl aclitem[],
    renamed_constraints jsonb not null default '{}'::jsonb,   -- {"new_name": "old_name"}
    added_columns text[] not null default '{}',
    renamed_columns jsonb not null default '{}'::jsonb,       -- {"new_name": "old_name"}
    moved_at timestamptz not null default now(),
    rolled_back_at timestamptz
  );
  revoke all on reventicket_audit.schema_move from public, anon, authenticated;
  if exists (select 1 from reventicket_audit.schema_move where rolled_back_at is null) then
    raise exception 'RT_MOVE: a previous move is still recorded as active';
  end if;
  delete from reventicket_audit.schema_move;
  insert into reventicket_audit.schema_move (table_name, original_owner, original_acl)
  select c.relname, pg_get_userbyid(c.relowner), c.relacl
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname = any(legacy);

  -- ---------------------------------------------------------------- move
  -- PostgreSQL 16+: a CREATEROLE role needs explicit membership to hand objects to another role.
  execute format('grant reventicket_app to %I', current_user);
  create schema reventicket authorization reventicket_app;
  revoke all on schema reventicket from public, anon, authenticated;
  alter role reventicket_app set search_path = reventicket;

  foreach t in array legacy loop
    execute format('alter table public.%I set schema reventicket', t);
    execute format('alter table reventicket.%I owner to reventicket_app', t);
    execute format('revoke all on table reventicket.%I from public, anon, authenticated, service_role', t);
  end loop;

  -- Column drift with shared/schema.ts (REVENTICKET_APP_FINDINGS.md F4).
  alter table reventicket.otp_codes rename column used to verified;
  update reventicket_audit.schema_move set renamed_columns = '{"verified": "used"}' where table_name = 'otp_codes';
  had_is_featured := exists (select 1 from information_schema.columns
                             where table_schema = 'reventicket' and table_name = 'events' and column_name = 'is_featured');
  if not had_is_featured then
    alter table reventicket.events add column is_featured boolean not null default false;
    update reventicket_audit.schema_move set added_columns = array['is_featured'] where table_name = 'events';
  end if;
  -- Unique constraints named as drizzle expects; otherwise `drizzle-kit push` tries to re-add them and offers to
  -- TRUNCATE the table first (observed for users.email).
  for r in
    select k.conname, w.tbl, w.wanted
    from (values ('users', 'email', 'users_email_unique'), ('config', 'key', 'config_key_unique')) w(tbl, col, wanted)
    join pg_constraint k on k.conrelid = ('reventicket.' || w.tbl)::regclass and k.contype = 'u'
     and k.conkey = array[(select attnum from pg_attribute where attrelid = ('reventicket.' || w.tbl)::regclass and attname = w.col)]
    where k.conname <> w.wanted
  loop
    execute format('alter table reventicket.%I rename constraint %I to %I', r.tbl, r.conname, r.wanted);
    update reventicket_audit.schema_move set renamed_constraints = renamed_constraints || jsonb_build_object(r.wanted, r.conname)
      where table_name = r.tbl;
  end loop;

  -- Runtime tables, created here with the exact names shared/schema.ts (patch 0005) declares, so neither the app's
  -- CREATE TABLE IF NOT EXISTS nor drizzle-kit wants to rename, re-add or drop anything.
  -- connect-pg-simple cannot create its table from the bundle (ENOENT dist/table.sql).
  create table reventicket.session (sid varchar not null primary key, sess json not null, expire timestamp(6) not null);
  create index session_expire_idx on reventicket.session (expire);
  create table reventicket.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id varchar references reventicket.users(id) on delete cascade,
    endpoint text not null constraint push_subscriptions_endpoint_unique unique,
    p256dh text not null,
    auth text not null,
    role text not null default 'admin',
    created_at timestamptz not null default now()
  );
  alter table reventicket.session owner to reventicket_app;
  alter table reventicket.push_subscriptions owner to reventicket_app;
  revoke all on table reventicket.session, reventicket.push_subscriptions from public, anon, authenticated, service_role;

  execute format('revoke reventicket_app from %I', current_user);

  -- ---------------------------------------------------------------- postconditions (fail = full rollback)
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = any(legacy)) then
    raise exception 'RT_MOVE_POST: a legacy table is still in public';
  end if;
  if has_schema_privilege('anon', 'reventicket', 'usage') or has_schema_privilege('authenticated', 'reventicket', 'usage') then
    raise exception 'RT_MOVE_POST: client roles can reach schema reventicket';
  end if;
  if exists (select 1 from pg_class where relnamespace = 'reventicket'::regnamespace and relkind = 'r'
               and pg_get_userbyid(relowner) <> 'reventicket_app') then
    raise exception 'RT_MOVE_POST: a table in reventicket is not owned by reventicket_app';
  end if;
  if has_schema_privilege('reventicket_app', 'public', 'create') then
    raise exception 'RT_MOVE_POST: reventicket_app can create objects in public';
  end if;
  raise notice 'RT_MOVED: 8 tables + session + push_subscriptions now in schema reventicket, owned by reventicket_app';
end
$move$;
