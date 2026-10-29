-- RevenTicket · move to its own schema (PROPOSAL — not applied; alternative/complement to the least-privilege plan).
-- Moves the 8 legacy tables WITH their rows from `public` to `reventicket`, owned by a dedicated login role
-- that is not a Supabase client role, and fixes the column drift so `drizzle-kit push` (with
-- schemaFilter ["reventicket"]) can create the missing tables without rename prompts.
-- One DO statement: atomic under any client. Run as `postgres` on the CONFIRMED RevenTicket database only.
--
-- Before: create the login role out of band so no password is ever written in SQL files or logs, e.g. in the
-- Supabase dashboard, or: create role reventicket_app login password '<generated, stored in Railway only>';
-- After:  point Railway's DATABASE_URL at reventicket_app, deploy the app with patch 0005 (pgSchema + schemaFilter),
--         run `drizzle-kit push` ONLY with that config, then verify_remote/identify reports.
do $move$
declare
  legacy constant text[] := array['users','venues','events','zones','tickets','orders','otp_codes','config'];
  expected_fingerprint constant text := '__SET_FROM_VERIFY_REMOTE__';
  actual text;
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'reventicket_app' and rolcanlogin) then
    raise exception 'RT_MOVE: create the login role reventicket_app first (password managed outside SQL files)';
  end if;
  if to_regnamespace('reventicket') is not null then
    raise exception 'RT_MOVE: schema reventicket already exists; review before re-running';
  end if;
  foreach t in array legacy loop
    if to_regclass('public.' || t) is null then raise exception 'RT_MOVE: public.% not found', t; end if;
  end loop;
  execute $q$
    select md5(coalesce(string_agg(x, ',' order by x), ''))
    from (select 'config:' || id as x from public.config union all select 'events:' || id from public.events
          union all select 'orders:' || id from public.orders union all select 'otp_codes:' || id from public.otp_codes
          union all select 'tickets:' || id from public.tickets union all select 'users:' || id from public.users
          union all select 'venues:' || id from public.venues union all select 'zones:' || id from public.zones) s
  $q$ into actual;
  if expected_fingerprint !~ '^[0-9a-f]{32}$' or actual <> expected_fingerprint then
    raise exception 'RT_MOVE: fingerprint missing or different (found %); wrong database or data changed', actual;
  end if;

  create schema reventicket authorization reventicket_app;
  revoke all on schema reventicket from public, anon, authenticated;
  execute 'alter role reventicket_app set search_path = reventicket';

  foreach t in array legacy loop
    execute format('alter table public.%I set schema reventicket', t);
    execute format('alter table reventicket.%I owner to reventicket_app', t);
    execute format('revoke all on table reventicket.%I from anon, authenticated', t);
  end loop;

  -- Column drift with shared/schema.ts (see REVENTICKET_APP_FINDINGS.md F4).
  alter table reventicket.otp_codes rename column used to verified;
  alter table reventicket.events add column if not exists is_featured boolean not null default false;
  -- Unique constraints named as drizzle expects; otherwise `drizzle-kit push` tries to re-add them and offers to
  -- TRUNCATE the table first (observed for users.email).
  declare
    c record;
  begin
    for c in
      select k.conname, w.wanted
      from (values ('users', 'email', 'users_email_unique'), ('config', 'key', 'config_key_unique')) w(tbl, col, wanted)
      join pg_constraint k on k.conrelid = ('reventicket.' || w.tbl)::regclass and k.contype = 'u'
       and k.conkey = array[(select attnum from pg_attribute where attrelid = ('reventicket.' || w.tbl)::regclass and attname = w.col)]
      where k.conname <> w.wanted
    loop
      execute format('alter table reventicket.%I rename constraint %I to %I',
                     split_part(c.wanted, '_', 1), c.conname, c.wanted);
    end loop;
  end;

  -- Post-conditions
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = any(legacy)) then
    raise exception 'RT_MOVE_POST: a legacy table is still in public';
  end if;
  if has_schema_privilege('anon', 'reventicket', 'usage') or has_schema_privilege('authenticated', 'reventicket', 'usage') then
    raise exception 'RT_MOVE_POST: client roles can reach schema reventicket';
  end if;
  raise notice 'RT_MOVED: 8 tables now in schema reventicket, owned by reventicket_app';
end
$move$;
