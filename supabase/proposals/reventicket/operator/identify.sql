-- Read-only identification that works on ANY PostgreSQL database (Supabase or not, with or without the RevenTicket
-- or VANTA tables). Reports only metadata: version, roles present, table NAMES and counts. No row contents.
select json_build_object(
  'server_version', current_setting('server_version'),
  'current_user', current_user,
  'current_database', current_database(),
  'is_supabase', exists (select 1 from pg_roles where rolname = 'anon')
                 and exists (select 1 from pg_roles where rolname = 'authenticated')
                 and to_regnamespace('auth') is not null,
  'public_table_count', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')),
  'reventicket_legacy_tables_present', (select coalesce(array_agg(t order by t), '{}') from unnest(array[
      'config','events','orders','otp_codes','tickets','users','venues','zones']) t where to_regclass('public.' || t) is not null),
  'vanta_tables_present', (select count(*) from unnest(array['teams','games','game_facts','odds_snapshots','model_versions',
      'predictions','followed_teams','user_preferences','profiles','data_sources','ingestion_runs']) t
      where to_regclass('public.' || t) is not null),
  'backend_runtime_tables_present', (select coalesce(array_agg(t order by t), '{}') from unnest(array[
      'session','push_subscriptions','discount_codes','event_maps']) t where to_regclass('public.' || t) is not null),
  'other_public_tables', (select coalesce(array_agg(c.relname::text order by c.relname), '{}') from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
        and c.relname not in ('config','events','orders','otp_codes','tickets','users','venues','zones',
                              'teams','games','game_facts','odds_snapshots','model_versions','predictions','followed_teams',
                              'user_preferences','profiles','data_sources','ingestion_runs',
                              'session','push_subscriptions','discount_codes','event_maps'))
) as identification;
