-- Remote verification of the hardening migration on the real Supabase project.
-- Runs the full RLS/security suite inside ONE transaction and rolls everything back:
-- fixtures, test users, the temporary schema and any writes disappear at the end.
-- Assertion failures raise 'ASSERTION FAILED: ...'. On success the script ends with the error
-- 'VANTA_REMOTE_SUITE_PASSED: 41 assertions passed ...' which forces the rollback.
begin;
-- VANTA EDGE RLS / security suite. Every assertion raises on failure.
create schema vanta_test_tmp;
grant usage on schema vanta_test_tmp to anon, authenticated, service_role;
create function vanta_test_tmp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
  perform set_config('vanta_test.passed', (coalesce(nullif(current_setting('vanta_test.passed', true), ''), '0')::int + 1)::text, true);
end $$;
create function vanta_test_tmp.throws(sql text, pattern text, msg text) returns void language plpgsql as $$
begin
  begin execute sql;
  exception when others then
    if sqlerrm ~* pattern then raise notice 'ok - %', msg; perform set_config('vanta_test.passed', (coalesce(nullif(current_setting('vanta_test.passed', true), ''), '0')::int + 1)::text, true); return; end if;
    raise exception 'ASSERTION FAILED: % (unexpected error: %)', msg, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % (statement succeeded)', msg;
end $$;
create function vanta_test_tmp.n(sql text) returns bigint language plpgsql as $$
declare c bigint; begin execute 'select count(*) from (' || sql || ') x' into c; return c; end $$;
grant execute on all functions in schema vanta_test_tmp to anon, authenticated, service_role;

-- ------------------------------------------------------------ fixtures (as owner/ingestion)
insert into public.teams (id, provider, provider_team_id, sport, name, short_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'fixture', 'h', 'LIGA_MX', 'Local FC', 'LOC'),
  ('00000000-0000-0000-0000-0000000000a2', 'fixture', 'a', 'LIGA_MX', 'Visitante FC', 'VIS');
insert into public.games (id, provider, provider_event_id, sport, competition, home_team_id, away_team_id, starts_at, raw_metadata)
values ('00000000-0000-0000-0000-0000000000b1', 'fixture', 'g1', 'LIGA_MX', 'Liga MX',
        '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() + interval '1 day', '{"secret_feed_field": 1}');
insert into public.odds_snapshots (game_id, provider, bookmaker, market_key, selection_key, decimal_odds, captured_at)
values ('00000000-0000-0000-0000-0000000000b1', 'fixture', 'book', '1x2', 'home', 2.1, now());
insert into public.model_versions (id, sport, model_name, version, training_cutoff) values
  ('00000000-0000-0000-0000-0000000000c1', 'LIGA_MX', 'online_poisson', '0.2.0', now() - interval '1 day');
insert into public.predictions (game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'LIGA_MX', '1x2', 'home', 0.5, now(), 'draft');

-- Publication gate (enforced even for privileged writers).
select vanta_test_tmp.throws($$update public.predictions set status = 'published', published_at = now()$$, 'MODEL_NOT_APPROVED',
  'cannot publish a prediction from an unapproved model');
select vanta_test_tmp.throws($$update public.model_versions set approved_for_publication = true$$, 'model_approval_evidence',
  'model approval requires approver, date and validation report');
select vanta_test_tmp.throws($$insert into public.predictions (game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status, published_at, is_demo)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'LIGA_MX', '1x2', 'away', 0.3, now(), 'published', now(), true)$$,
  'DEMO_CANNOT_PUBLISH', 'demo predictions can never be published');
select vanta_test_tmp.throws($$insert into public.predictions (game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status)
  values ('00000000-0000-0000-0000-0000000000b1', null, 'LIGA_MX', '1x2', 'away', 1.3, now(), 'draft')$$,
  'check', 'probabilities outside [0,1] are rejected');

-- ------------------------------------------------------------ anonymous visitor
set role anon;
select vanta_test_tmp.ok(vanta_test_tmp.n('select id, name from public.teams') = 2, 'anon reads teams');
select vanta_test_tmp.ok(vanta_test_tmp.n('select id, starts_at, status from public.games') = 1, 'anon reads games');
select vanta_test_tmp.throws('select raw_metadata from public.games', 'permission denied', 'anon cannot read raw provider payloads');
select vanta_test_tmp.throws('select * from public.odds_snapshots', 'permission denied', 'anon cannot read licensed odds');
select vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 0, 'anon sees no draft predictions');
select vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.model_versions') = 0, 'anon sees no unapproved models');
select vanta_test_tmp.throws('select feature_snapshot from public.predictions', 'permission denied', 'feature snapshots are private');
select vanta_test_tmp.throws($$insert into public.games (provider, provider_event_id, sport, competition, home_team_id, away_team_id, starts_at)
  values ('x', 'y', 'NBA', 'NBA', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now())$$,
  'permission denied', 'anon cannot write games');
select vanta_test_tmp.throws($$update public.games set home_score = 9$$, 'permission denied', 'anon cannot alter results');
select vanta_test_tmp.throws($$insert into public.predictions (game_id, sport, market_key, selection_key, probability, data_cutoff)
  values ('00000000-0000-0000-0000-0000000000b1', 'LIGA_MX', 'x', 'y', 0.9, now())$$, 'permission denied', 'anon cannot write predictions');
select vanta_test_tmp.throws($$insert into public.model_versions (sport, model_name, version, training_cutoff) values ('NBA', 'x', '1', now())$$,
  'permission denied', 'anon cannot register models');
select vanta_test_tmp.throws($$insert into public.odds_snapshots (game_id, provider, bookmaker, market_key, selection_key, decimal_odds, captured_at)
  values ('00000000-0000-0000-0000-0000000000b1', 'x', 'y', 'm', 's', 2, now())$$, 'permission denied', 'anon cannot write odds');
select vanta_test_tmp.throws('select * from public.profiles', 'permission denied', 'anon cannot read profiles');
select vanta_test_tmp.throws('select * from public.ingestion_runs', 'permission denied', 'anon cannot read ingestion internals');
select vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.data_freshness') = 1, 'anon can read aggregate data freshness');
reset role;

-- ------------------------------------------------------------ signup rules
select vanta_test_tmp.throws($$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'kid@example.com', '{"app":"vanta-edge"}')$$,
  'ADULT_ATTESTATION_REQUIRED', 'VANTA signup requires 18+ attestation');
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.com', '{"app":"vanta-edge","adult_attested":"true","terms_version":"v1"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.com', '{"app":"vanta-edge","adult_attested":"true","terms_version":"v1"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'other-app@example.com', '{}');
select vanta_test_tmp.ok((select count(*) from public.profiles) = 2, 'profiles created only for VANTA signups (other apps unaffected)');
select vanta_test_tmp.ok((select bool_and(not notifications_enabled) from public.user_preferences), 'notifications are opt-in');

-- ------------------------------------------------------------ user A
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set role authenticated;
select vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.profiles') = 1, 'A sees only own profile');
update public.profiles set display_name = 'Ana';
select vanta_test_tmp.throws($$update public.profiles set adult_attested_at = null$$, 'permission denied', 'A cannot clear the age attestation');
select vanta_test_tmp.throws($$insert into public.profiles (id) values ('bbbbbbbb-0000-0000-0000-00000000000b')$$, 'permission denied', 'A cannot create profiles');
insert into public.followed_teams (user_id, team_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1');
select vanta_test_tmp.throws($$insert into public.followed_teams (user_id, team_id) values ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2')$$,
  'row-level security', 'A cannot follow teams on behalf of B');
update public.user_preferences set favorite_sports = '{LIGA_MX,NBA}', notifications_enabled = true;
select vanta_test_tmp.ok((select notifications_enabled from public.user_preferences) is true, 'A can opt in to notifications');
select vanta_test_tmp.throws($$update public.games set status = 'final'$$, 'permission denied', 'authenticated users cannot alter games');
select vanta_test_tmp.throws($$update public.predictions set probability = 0.99$$, 'permission denied', 'authenticated users cannot alter predictions');
select vanta_test_tmp.throws('select * from public.odds_snapshots', 'permission denied', 'authenticated users cannot read raw odds');
reset role;

-- ------------------------------------------------------------ user B (attacker)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set role authenticated;
select vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.profiles') = 1 and (select display_name from public.profiles) = '', 'B cannot see A profile');
select vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.followed_teams') = 0, 'B cannot see A follows');
select vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.user_preferences where user_id = ''aaaaaaaa-0000-0000-0000-00000000000a''') = 0, 'B cannot see A preferences');
with x as (delete from public.followed_teams returning 1) select vanta_test_tmp.ok(count(*) = 0, 'B cannot delete A follows') from x;
with x as (update public.user_preferences set notifications_enabled = false where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' returning 1)
  select vanta_test_tmp.ok(count(*) = 0, 'B cannot change A preferences') from x;
reset role;

-- ------------------------------------------------------------ approved model → publication path
update public.model_versions set approved_for_publication = true, approved_at = now(), approved_by = 'test-reviewer',
  validation_report_uri = 'reports/vanta_test_tmp.json';
update public.predictions set status = 'published', published_at = now();
set role anon;
select vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 1, 'anon sees published predictions of approved models');
select vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.model_versions') = 1, 'anon sees approved model metadata');
reset role;
select vanta_test_tmp.throws($$update public.predictions set probability = 0.9$$, 'IMMUTABLE', 'published predictions cannot be rewritten');
select vanta_test_tmp.throws($$delete from public.predictions$$, 'IMMUTABLE', 'published predictions cannot be deleted');
update public.predictions set status = 'settled', settled_at = now(), outcome = true;
select vanta_test_tmp.ok((select settled from public.published_performance) = 1, 'settlement is allowed and feeds audited performance');
update public.model_versions set approved_for_publication = false, approved_at = null, approved_by = null;
set role anon;
select vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 0, 'revoking model approval hides its predictions');
reset role;
-- Final step: abort on purpose so nothing can be committed, even if the client wraps the script
-- in its own transaction. Success is reported through this error message.
reset role;
do $$ begin
  raise exception 'VANTA_REMOTE_SUITE_PASSED: % assertions passed; all test changes rolled back',
    current_setting('vanta_test.passed', true);
end $$;
rollback;
