-- RevenTicket least privilege · READ-ONLY verification (run before and after applying).
-- Prints no row contents: only privileges, structure and counts.
select json_build_object(
  'client_privileges_on_legacy', (
    select json_object_agg(t, json_build_object(
      'anon', has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete,truncate,references,trigger' || case when current_setting('server_version_num')::int >= 170000 then ',maintain' else '' end),
      'authenticated', has_table_privilege('authenticated', 'public.' || t, 'select,insert,update,delete,truncate,references,trigger' || case when current_setting('server_version_num')::int >= 170000 then ',maintain' else '' end),
      'service_role', has_table_privilege('service_role', 'public.' || t, 'select'),
      'rls', (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)))
    from unnest(array['config','events','orders','otp_codes','tickets','users','venues','zones']) t),
  'legacy_policies', (select count(*) from pg_policies where schemaname = 'public'
                        and tablename in ('config','events','orders','otp_codes','tickets','users','venues','zones')),
  'legacy_row_counts', (select json_build_object(
      'users', (select count(*) from public.users), 'events', (select count(*) from public.events),
      'venues', (select count(*) from public.venues), 'zones', (select count(*) from public.zones),
      'tickets', (select count(*) from public.tickets), 'orders', (select count(*) from public.orders),
      'otp_codes', (select count(*) from public.otp_codes), 'config', (select count(*) from public.config))),
  'legacy_ids_md5', (select md5(string_agg(x, ',' order by x)) from (
      select 'u' || id as x from public.users union all select 'e' || id from public.events
      union all select 'v' || id from public.venues) s),
  'default_privileges_for_current_user', (
    select json_agg(json_build_object('type', d.defaclobjtype, 'grantee', pg_get_userbyid(a.grantee), 'priv', a.privilege_type))
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = current_user::regrole and d.defaclnamespace = 'public'::regnamespace
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)),
  'audit_rows', case when to_regclass('reventicket_audit.revoked_privileges') is null then null else
      (xpath('/row/c/text()', query_to_xml('select count(*) as c from reventicket_audit.revoked_privileges where restored_at is null', false, true, '')))[1]::text end,
  'vanta', json_build_object(
      'triggers', (select string_agg(tgname, ',' order by tgname) from pg_trigger where tgname like 'vanta%' and not tgisinternal),
      'policies', (select count(*) from pg_policies where schemaname = 'public'
                     and tablename not in ('config','events','orders','otp_codes','tickets','users','venues','zones')),
      'anon_odds', has_table_privilege('anon', 'public.odds_snapshots', 'select'),
      'anon_raw_metadata', has_column_privilege('anon', 'public.games', 'raw_metadata', 'select'))
) as reventicket_least_privilege_state;
