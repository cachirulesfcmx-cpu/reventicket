-- Remote verification of the hardening migration on the real Supabase project.
--
-- Atomicity: the whole suite is ONE `DO` statement. A single statement is atomic under any client
-- behaviour (autocommit, implicit or explicit transaction, statement splitting), and it ALWAYS ends
-- by raising an exception, so every change it made (temp schema, fixtures, test users, writes) is
-- rolled back by PostgreSQL itself. There is no COMMIT anywhere.
--
-- Result: on success the statement fails with
--   VANTA_REMOTE_SUITE_PASSED: 41/41 assertions passed; all test changes rolled back | 1. ... | 41. ...
-- Any failure fails with 'ASSERTION FAILED: ...' plus the assertions that passed before it.
do $suite$
declare
  c bigint;
  passed text[];
begin
  -- ---------------------------------------------------------------- helpers (rolled back with the rest)
  create schema vanta_test_tmp;
  grant usage on schema vanta_test_tmp to anon, authenticated;
  create function vanta_test_tmp.pass(msg text) returns void language plpgsql as $f$
  begin
    perform set_config('vanta_test.log', coalesce(nullif(current_setting('vanta_test.log', true), ''), '') || chr(30) || msg, true);
  end $f$;
  create function vanta_test_tmp.log() returns text[] language sql as $f$
    select coalesce(array_remove(string_to_array(current_setting('vanta_test.log', true), chr(30)), ''), '{}')
  $f$;
  create function vanta_test_tmp.ok(cond boolean, msg text) returns void language plpgsql as $f$
  begin
    if cond is distinct from true then
      raise exception 'ASSERTION FAILED: % | passed before: %', msg, vanta_test_tmp.log();
    end if;
    perform vanta_test_tmp.pass(msg);
  end $f$;
  create function vanta_test_tmp.throws(sql text, pattern text, msg text) returns void language plpgsql as $f$
  begin
    begin
      execute sql;
    exception when others then
      if sqlerrm ~* pattern then perform vanta_test_tmp.pass(msg); return; end if;
      raise exception 'ASSERTION FAILED: % (unexpected error: %) | passed before: %', msg, sqlerrm, vanta_test_tmp.log();
    end;
    raise exception 'ASSERTION FAILED: % (statement succeeded) | passed before: %', msg, vanta_test_tmp.log();
  end $f$;
  create function vanta_test_tmp.n(sql text) returns bigint language plpgsql as $f$
  declare c bigint; begin execute 'select count(*) from (' || sql || ') x' into c; return c; end $f$;
  grant execute on all functions in schema vanta_test_tmp to anon, authenticated;

  -- ---------------------------------------------------------------- fixtures (as owner / ingestion)
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
  insert into public.predictions (id, game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
          'LIGA_MX', '1x2', 'home', 0.5, now(), 'draft');

  -- ---------------------------------------------------------------- publication gate (even for privileged writers)
  perform vanta_test_tmp.throws($q$update public.predictions set status = 'published', published_at = now() where id = '00000000-0000-0000-0000-0000000000d1'$q$,
    'MODEL_NOT_APPROVED', 'cannot publish a prediction from an unapproved model');
  perform vanta_test_tmp.throws($q$update public.model_versions set approved_for_publication = true where id = '00000000-0000-0000-0000-0000000000c1'$q$,
    'model_approval_evidence', 'model approval requires approver, date and validation report');
  perform vanta_test_tmp.throws($q$insert into public.predictions (game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status, published_at, is_demo)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'LIGA_MX', '1x2', 'away', 0.3, now(), 'published', now(), true)$q$,
    'DEMO_CANNOT_PUBLISH', 'demo predictions can never be published');
  perform vanta_test_tmp.throws($q$insert into public.predictions (game_id, model_version_id, sport, market_key, selection_key, probability, data_cutoff, status)
    values ('00000000-0000-0000-0000-0000000000b1', null, 'LIGA_MX', '1x2', 'away', 1.3, now(), 'draft')$q$,
    'check', 'probabilities outside [0,1] are rejected');

  -- ---------------------------------------------------------------- anonymous visitor
  set local role anon;
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id, name from public.teams') = 2, 'anon reads teams');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id, starts_at, status from public.games') = 1, 'anon reads games');
  perform vanta_test_tmp.throws('select raw_metadata from public.games', 'permission denied', 'anon cannot read raw provider payloads');
  perform vanta_test_tmp.throws('select * from public.odds_snapshots', 'permission denied', 'anon cannot read licensed odds');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 0, 'anon sees no draft predictions');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.model_versions') = 0, 'anon sees no unapproved models');
  perform vanta_test_tmp.throws('select feature_snapshot from public.predictions', 'permission denied', 'feature snapshots are private');
  perform vanta_test_tmp.throws($q$insert into public.games (provider, provider_event_id, sport, competition, home_team_id, away_team_id, starts_at)
    values ('x', 'y', 'NBA', 'NBA', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now())$q$,
    'permission denied', 'anon cannot write games');
  perform vanta_test_tmp.throws($q$update public.games set home_score = 9$q$, 'permission denied', 'anon cannot alter results');
  perform vanta_test_tmp.throws($q$insert into public.predictions (game_id, sport, market_key, selection_key, probability, data_cutoff)
    values ('00000000-0000-0000-0000-0000000000b1', 'LIGA_MX', 'x', 'y', 0.9, now())$q$, 'permission denied', 'anon cannot write predictions');
  perform vanta_test_tmp.throws($q$insert into public.model_versions (sport, model_name, version, training_cutoff) values ('NBA', 'x', '1', now())$q$,
    'permission denied', 'anon cannot register models');
  perform vanta_test_tmp.throws($q$insert into public.odds_snapshots (game_id, provider, bookmaker, market_key, selection_key, decimal_odds, captured_at)
    values ('00000000-0000-0000-0000-0000000000b1', 'x', 'y', 'm', 's', 2, now())$q$, 'permission denied', 'anon cannot write odds');
  perform vanta_test_tmp.throws('select * from public.profiles', 'permission denied', 'anon cannot read profiles');
  perform vanta_test_tmp.throws('select * from public.ingestion_runs', 'permission denied', 'anon cannot read ingestion internals');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.data_freshness') = 1, 'anon can read aggregate data freshness');
  reset role;

  -- ---------------------------------------------------------------- signup rules
  perform vanta_test_tmp.throws($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'kid@example.com', '{"app":"vanta-edge"}')$q$,
    'ADULT_ATTESTATION_REQUIRED', 'VANTA signup requires 18+ attestation');
  insert into auth.users (id, email, raw_user_meta_data) values
    ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.com', '{"app":"vanta-edge","adult_attested":"true","terms_version":"v1"}'),
    ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.com', '{"app":"vanta-edge","adult_attested":"true","terms_version":"v1"}'),
    ('cccccccc-0000-0000-0000-00000000000c', 'other-app@example.com', '{}');
  perform vanta_test_tmp.ok((select count(*) from public.profiles) = 2, 'profiles created only for VANTA signups (other apps unaffected)');
  perform vanta_test_tmp.ok((select bool_and(not notifications_enabled) from public.user_preferences), 'notifications are opt-in');

  -- ---------------------------------------------------------------- user A
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  set local role authenticated;
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.profiles') = 1, 'A sees only own profile');
  update public.profiles set display_name = 'Ana';
  perform vanta_test_tmp.throws($q$update public.profiles set adult_attested_at = null$q$, 'permission denied', 'A cannot clear the age attestation');
  perform vanta_test_tmp.throws($q$insert into public.profiles (id) values ('bbbbbbbb-0000-0000-0000-00000000000b')$q$, 'permission denied', 'A cannot create profiles');
  insert into public.followed_teams (user_id, team_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1');
  perform vanta_test_tmp.throws($q$insert into public.followed_teams (user_id, team_id) values ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2')$q$,
    'row-level security', 'A cannot follow teams on behalf of B');
  update public.user_preferences set favorite_sports = '{LIGA_MX,NBA}', notifications_enabled = true;
  perform vanta_test_tmp.ok((select notifications_enabled from public.user_preferences) is true, 'A can opt in to notifications');
  perform vanta_test_tmp.throws($q$update public.games set status = 'final'$q$, 'permission denied', 'authenticated users cannot alter games');
  perform vanta_test_tmp.throws($q$update public.predictions set probability = 0.99$q$, 'permission denied', 'authenticated users cannot alter predictions');
  perform vanta_test_tmp.throws('select * from public.odds_snapshots', 'permission denied', 'authenticated users cannot read raw odds');
  reset role;

  -- ---------------------------------------------------------------- user B (attacker)
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  set local role authenticated;
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.profiles') = 1 and (select display_name from public.profiles) = '', 'B cannot see A profile');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select * from public.followed_teams') = 0, 'B cannot see A follows');
  perform vanta_test_tmp.ok(vanta_test_tmp.n($q$select * from public.user_preferences where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$q$) = 0, 'B cannot see A preferences');
  with x as (delete from public.followed_teams returning 1) select count(*) into c from x;
  perform vanta_test_tmp.ok(c = 0, 'B cannot delete A follows');
  with x as (update public.user_preferences set notifications_enabled = false where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' returning 1)
    select count(*) into c from x;
  perform vanta_test_tmp.ok(c = 0, 'B cannot change A preferences');
  reset role;

  -- ---------------------------------------------------------------- approved model -> publication path
  update public.model_versions set approved_for_publication = true, approved_at = now(), approved_by = 'test-reviewer',
    validation_report_uri = 'reports/vanta_test_tmp.json' where id = '00000000-0000-0000-0000-0000000000c1';
  update public.predictions set status = 'published', published_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
  set local role anon;
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 1, 'anon sees published predictions of approved models');
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.model_versions') = 1, 'anon sees approved model metadata');
  reset role;
  perform vanta_test_tmp.throws($q$update public.predictions set probability = 0.9 where id = '00000000-0000-0000-0000-0000000000d1'$q$,
    'IMMUTABLE', 'published predictions cannot be rewritten');
  perform vanta_test_tmp.throws($q$delete from public.predictions where id = '00000000-0000-0000-0000-0000000000d1'$q$,
    'IMMUTABLE', 'published predictions cannot be deleted');
  update public.predictions set status = 'settled', settled_at = now(), outcome = true where id = '00000000-0000-0000-0000-0000000000d1';
  perform vanta_test_tmp.ok((select settled from public.published_performance) = 1, 'settlement is allowed and feeds audited performance');
  update public.model_versions set approved_for_publication = false, approved_at = null, approved_by = null
    where id = '00000000-0000-0000-0000-0000000000c1';
  set local role anon;
  perform vanta_test_tmp.ok(vanta_test_tmp.n('select id from public.predictions') = 0, 'revoking model approval hides its predictions');
  reset role;

  -- ---------------------------------------------------------------- report and force the rollback
  passed := vanta_test_tmp.log();
  if coalesce(array_length(passed, 1), 0) <> 41 then
    raise exception 'ASSERTION FAILED: expected 41 assertions, got % | passed: %', coalesce(array_length(passed, 1), 0), passed;
  end if;
  raise exception 'VANTA_REMOTE_SUITE_PASSED: %/41 assertions passed; all test changes rolled back | %',
    array_length(passed, 1),
    (select string_agg(i || '. ' || passed[i], ' | ' order by i) from generate_subscripts(passed, 1) i);
end
$suite$;
