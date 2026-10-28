-- StudIA security / RLS suite. Proves tenant isolation (user A vs user B), parental
-- safeguards, hidden answer keys, upload rules and atomic AI quotas.
-- Every assertion raises on failure, so psql ON_ERROR_STOP turns it into a red build.

create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Runs SQL as the current role and asserts it fails with a message matching pattern.
create function test.throws(sql text, pattern text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm ~* pattern then raise notice 'ok - %', msg; return; end if;
    raise exception 'ASSERTION FAILED: % (unexpected error: %)', msg, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % (statement succeeded)', msg;
end $$;

create function test.count_of(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin execute 'select count(*) from (' || sql || ') x' into n; return n; end $$;

grant execute on all functions in schema test to anon, authenticated, service_role;

create table test.ctx (k text primary key, v text);
grant all on test.ctx to anon, authenticated, service_role;

-- ---------------------------------------------------------------- signup rules
select test.throws($$insert into auth.users (email, raw_user_meta_data) values ('kid@example.com', '{"privacy_notice_version":"v1"}')$$,
  'ADULT_ATTESTATION_REQUIRED', 'signup without adult attestation is rejected');
select test.throws($$insert into auth.users (email, raw_user_meta_data) values ('x@example.com', '{"adult_attested":"true"}')$$,
  'PRIVACY_NOTICE_REQUIRED', 'signup without privacy notice version is rejected');

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.com', '{"adult_attested":"true","privacy_notice_version":"v1","display_name":"Ana","account_type":"admin"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.com', '{"adult_attested":"true","privacy_notice_version":"v1","display_name":"Beto"}');
select test.ok((select account_type from public.user_profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a') = 'guardian',
  'client metadata cannot pick an unknown/privileged account type');
select test.ok((select not is_admin and plan = 'free' from public.user_profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'new accounts are never admin and start on free plan');

-- ---------------------------------------------------------------- anon has nothing
set role anon;
select test.throws('select * from public.user_profiles', 'permission denied', 'anon cannot read profiles');
select test.throws('select * from public.study_plans', 'permission denied', 'anon cannot read plans');
select test.throws('select public.family_report()', 'permission denied', 'anon cannot call family_report');
select test.throws('select public.export_my_data()', 'permission denied', 'anon cannot export data');
select test.throws('select public.consume_ai_quota(''aaaaaaaa-0000-0000-0000-00000000000a'', 100)', 'permission denied', 'anon cannot touch AI quota');
select test.ok(test.count_of('select * from public.subjects') > 0, 'anon can read the public subject catalog');
reset role;

-- ---------------------------------------------------------------- user A
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
set role authenticated;

select test.throws($$update public.user_profiles set is_admin = true$$, 'permission denied', 'A cannot self-promote to admin');
select test.throws($$update public.user_profiles set plan = 'plus'$$, 'permission denied', 'A cannot change own plan');
update public.user_profiles set display_name = 'Ana M';
select test.ok((select display_name from public.user_profiles) = 'Ana M', 'A can edit own display name');

select test.throws($$insert into public.student_profiles (guardian_id, display_name, school_level, grade_label)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Kid', 'primaria', '5')$$, 'permission denied',
  'students cannot be inserted directly (consent bypass)');
select test.throws($$select public.create_student_profile('Kid', 'primaria', '5', 'v1', false)$$,
  'GUARDIAN_CONSENT_REQUIRED', 'student creation without consent is rejected');
insert into test.ctx values ('studentA', public.create_student_profile('Leo', 'primaria', '5', 'v1', true)::text);
select test.ok(test.count_of('select * from public.guardian_consents') = 1, 'consent recorded atomically with the student');

select test.throws($$select public.save_onboarding('{"role":"student","voice":"luna","ageBand":"13_17","need":"upcoming_exam","prepMode":"create","goal":"good","materials":"no_notes"}'::jsonb)$$,
  'MINOR_REQUIRES_GUARDIAN_PROFILE', 'minor onboarding without a guardian-managed profile is rejected server-side');
select test.ok(public.save_onboarding('{"role":"student","voice":"luna","ageBand":"13_17","need":"upcoming_exam","prepMode":"create","goal":"good","materials":"no_notes","subject":"Matemáticas","examDate":"2026-11-02","injected":"<script>"}'::jsonb,
  (select v::uuid from test.ctx where k = 'studentA')) is not null, 'minor onboarding attached to consented student profile');
select test.ok(not ((select answers from public.onboarding_responses limit 1) ? 'injected'), 'onboarding answers are whitelisted');
select test.throws($$select public.save_onboarding('{"role":"hacker","voice":"luna","ageBand":"18_plus","need":"upcoming_exam","prepMode":"create","goal":"good","materials":"no_notes"}'::jsonb)$$,
  'INVALID_ANSWERS', 'invalid enum values are rejected');

insert into public.study_plans (user_id, student_id, title, subject_slug, topics, exam_date)
values ('aaaaaaaa-0000-0000-0000-00000000000a', (select v::uuid from test.ctx where k = 'studentA'),
        'Examen de fracciones', 'matematicas', array['Fracciones','Porcentajes'], current_date + 10);
insert into test.ctx select 'planA', id::text from public.study_plans;
select test.ok(public.generate_plan_sessions((select v::uuid from test.ctx where k = 'planA')) = 6, 'planner generates diagnostic + 2 per topic + mock');
select test.ok((select max(scheduled_for) from public.study_sessions) <= current_date + 9, 'sessions are scheduled before the exam date');
select test.throws($$select public.generate_plan_sessions((select v::uuid from test.ctx where k = 'planA'))$$,
  'ALREADY_GENERATED', 'planner is idempotent-safe');

-- Quiz: answer key is never exposed before submission and grading is deterministic.
select test.throws('select correct_index from public.questions', 'permission denied', 'answer key table is not readable');
insert into test.ctx select 'quizA', public.start_quiz('matematicas', 4, (select v::uuid from test.ctx where k = 'studentA'))::text;
select test.ok(position('correct' in (select v from test.ctx where k = 'quizA')) = 0, 'start_quiz payload does not leak correct answers');
select test.ok(((select v::jsonb from test.ctx where k = 'quizA') ->> 'includesDemo')::boolean, 'demo content is flagged as demo');
reset role;
-- Build an all-correct answer sheet as the test harness (owner), then submit as A.
insert into test.ctx select 'answersA', jsonb_object_agg(q.id::text, q.correct_index)::text
  from public.questions q
  where q.id in (select (e ->> 'id')::uuid from jsonb_array_elements((select v::jsonb -> 'questions' from test.ctx where k = 'quizA')) e);
set role authenticated;
select test.ok((public.submit_quiz(((select v::jsonb from test.ctx where k = 'quizA') ->> 'attemptId')::uuid,
  (select v::jsonb from test.ctx where k = 'answersA')) ->> 'score')::numeric = 100, 'deterministic grading: all correct = 100');
select test.throws($$select public.submit_quiz(((select v::jsonb from test.ctx where k = 'quizA') ->> 'attemptId')::uuid, '{}'::jsonb)$$,
  'ALREADY_SUBMITTED', 'an attempt cannot be re-submitted');
insert into test.ctx select 'quizA2', public.start_quiz('matematicas', 4)::text;
select test.ok((public.submit_quiz(((select v::jsonb from test.ctx where k = 'quizA2') ->> 'attemptId')::uuid,
  '{"not-a-uuid": "x"}'::jsonb) ->> 'score')::numeric = 0, 'garbage answers grade as 0 without errors');
select test.ok(test.count_of('select * from public.my_subject_progress') >= 1, 'progress view returns own graded attempts');

-- Materials and storage.
select test.throws($$select public.register_material('virus', 'application/x-msdownload', 100)$$, 'UNSUPPORTED_TYPE', 'unsupported MIME rejected');
select test.throws($$select public.register_material('big', 'application/pdf', 20000000)$$, 'FILE_TOO_LARGE', 'oversized file rejected');
insert into test.ctx select 'matA', public.register_material('Apuntes', 'application/pdf', 2048)::text;
select test.ok((select v::jsonb ->> 'path' from test.ctx where k = 'matA') ~ '^aaaaaaaa-0000-0000-0000-00000000000a/[0-9a-f-]{36}\.pdf$',
  'storage path is server-generated in own folder with random name');
select test.throws($$insert into storage.objects (bucket_id, name, metadata) values ('study-materials', 'aaaaaaaa-0000-0000-0000-00000000000a/evil.pdf', '{}')$$,
  'row-level security', 'upload to an unregistered path is denied');
insert into storage.objects (bucket_id, name, metadata)
  select 'study-materials', v::jsonb ->> 'path', '{"size": 2048, "mimetype": "application/pdf"}' from test.ctx where k = 'matA';
select public.mark_material_uploaded(((select v::jsonb from test.ctx where k = 'matA') ->> 'id')::uuid);
select test.ok((select status from public.materials) = 'uploaded', 'verified upload moves to uploaded and is queued');
select test.throws($$insert into storage.objects (bucket_id, name, metadata)
  select 'study-materials', v::jsonb ->> 'path', '{}' from test.ctx where k = 'matA'$$, 'row-level security|duplicate',
  'a registered path cannot be uploaded twice');
insert into test.ctx select 'matA2', public.register_material('Foto', 'image/png', 1000)::text;
insert into storage.objects (bucket_id, name, metadata)
  select 'study-materials', v::jsonb ->> 'path', '{"size": 1000, "mimetype": "text/html"}' from test.ctx where k = 'matA2';
select public.mark_material_uploaded(((select v::jsonb from test.ctx where k = 'matA2') ->> 'id')::uuid);
select test.ok((select status from public.materials where id = ((select v::jsonb from test.ctx where k = 'matA2') ->> 'id')::uuid) = 'failed',
  'content-type mismatch is marked failed and never processed');
select test.throws('select public.claim_material_job()', 'permission denied', 'clients cannot claim worker jobs');
select test.throws($$select public.consume_ai_quota('aaaaaaaa-0000-0000-0000-00000000000a', 100)$$, 'permission denied', 'clients cannot consume quota directly');
select test.throws('select public.admin_overview()', 'FORBIDDEN', 'non-admin cannot read admin overview');
select test.ok(jsonb_array_length(public.family_report()) = 1, 'family report lists own student');
reset role;

-- ---------------------------------------------------------------- user B (attacker)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
set role authenticated;
select test.ok(test.count_of('select * from public.user_profiles') = 1, 'B sees only own profile');
select test.ok(test.count_of('select * from public.student_profiles') = 0, 'B cannot read A students');
select test.ok(test.count_of('select * from public.guardian_consents') = 0, 'B cannot read A consents');
select test.ok(test.count_of('select * from public.onboarding_responses') = 0, 'B cannot read A onboarding');
select test.ok(test.count_of('select * from public.study_plans') = 0, 'B cannot read A plans');
select test.ok(test.count_of('select * from public.study_sessions') = 0, 'B cannot read A sessions');
select test.ok(test.count_of('select * from public.exam_attempts') = 0, 'B cannot read A attempts');
select test.ok(test.count_of('select * from public.attempt_answers') = 0, 'B cannot read A answers');
select test.ok(test.count_of('select * from public.materials') = 0, 'B cannot read A materials');
select test.ok(test.count_of('select * from storage.objects') = 0, 'B cannot read A storage objects');
select test.ok(test.count_of('select * from public.my_subject_progress') = 0, 'B progress view is empty');
select test.ok(jsonb_array_length(public.family_report()) = 0, 'B family report is empty');
select test.ok((public.export_my_data() -> 'plans') = '[]'::jsonb, 'B export contains no A data');

with x as (update public.study_plans set title = 'pwned' returning 1) select test.ok(count(*) = 0, 'B cannot update A plans') from x;
with x as (delete from public.study_plans returning 1) select test.ok(count(*) = 0, 'B cannot delete A plans') from x;
with x as (delete from storage.objects returning 1) select test.ok(count(*) = 0, 'B cannot delete A objects') from x;
select test.throws($$insert into public.study_plans (user_id, title, subject_slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'matematicas')$$,
  'row-level security', 'B cannot create a plan owned by A');
select test.throws($$insert into public.study_plans (user_id, student_id, title, subject_slug)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', (select v::uuid from test.ctx where k = 'studentA'), 'x', 'matematicas')$$,
  'row-level security', 'B cannot attach a plan to A student');
select test.throws($$insert into public.study_sessions (plan_id, user_id, topic) values ((select v::uuid from test.ctx where k = 'planA'), 'bbbbbbbb-0000-0000-0000-00000000000b', 'x')$$,
  'row-level security', 'B cannot inject sessions into A plan');
select test.throws($$select public.generate_plan_sessions((select v::uuid from test.ctx where k = 'planA'))$$, 'NOT_FOUND', 'B cannot run planner on A plan');
select test.throws($$select public.submit_quiz(((select v::jsonb from test.ctx where k = 'quizA2') ->> 'attemptId')::uuid, '{}'::jsonb)$$,
  'NOT_FOUND', 'B cannot submit A attempt');
select test.throws($$select public.start_quiz('matematicas', 3, (select v::uuid from test.ctx where k = 'studentA'))$$, 'NOT_FOUND', 'B cannot quiz as A student');
select test.throws($$select public.save_onboarding('{"role":"student","voice":"luna","ageBand":"13_17","need":"upcoming_exam","prepMode":"create","goal":"good","materials":"no_notes"}'::jsonb,
  (select v::uuid from test.ctx where k = 'studentA'))$$, 'MINOR_REQUIRES_GUARDIAN_PROFILE', 'B cannot attach onboarding to A student');
select test.throws($$select public.register_material('x', 'application/pdf', 10, (select v::uuid from test.ctx where k = 'studentA'))$$, 'NOT_FOUND', 'B cannot register material for A student');
select test.throws($$select public.mark_material_uploaded(((select v::jsonb from test.ctx where k = 'matA') ->> 'id')::uuid)$$, 'NOT_FOUND', 'B cannot mark A material');
select test.throws($$select public.revoke_student_consent((select v::uuid from test.ctx where k = 'studentA'))$$, 'NOT_FOUND', 'B cannot revoke A consent');
select test.throws($$insert into storage.objects (bucket_id, name, metadata) values ('study-materials', 'aaaaaaaa-0000-0000-0000-00000000000a/x.pdf', '{}')$$,
  'row-level security', 'B cannot upload into A folder');
reset role;

-- ---------------------------------------------------------------- consent revocation
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.revoke_student_consent((select v::uuid from test.ctx where k = 'studentA'));
select test.throws($$select public.start_quiz('matematicas', 3, (select v::uuid from test.ctx where k = 'studentA'))$$, 'NOT_FOUND',
  'revoked consent blocks new activity for that student');
reset role;

-- ---------------------------------------------------------------- worker + quotas (service_role)
set role service_role;
select test.ok((select count(*) from public.claim_material_job()) = 1, 'worker claims exactly one queued job');
select test.ok((select count(*) from public.claim_material_job()) = 0, 'a claimed job is not handed out twice');
select public.complete_material_job((select id from public.material_jobs limit 1), 'texto extraído', null);
select test.ok((select status from public.materials where extracted_text is not null) = 'ready', 'completed job marks material ready');

do $$
declare i int;
begin
  for i in 1..20 loop
    perform public.consume_ai_quota('bbbbbbbb-0000-0000-0000-00000000000b', 100);
  end loop;
end $$;
select test.throws($$select public.consume_ai_quota('bbbbbbbb-0000-0000-0000-00000000000b', 100)$$, 'QUOTA_EXCEEDED', 'free plan blocked after 20 daily requests');
select test.ok((select requests from public.ai_usage_daily where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b') = 20, 'usage counter never exceeds the limit');
select test.ok(public.record_ai_usage('aaaaaaaa-0000-0000-0000-00000000000a', 100, 100, 6, 5), 'spend alert fires when threshold crossed');
select test.ok(not public.record_ai_usage('aaaaaaaa-0000-0000-0000-00000000000a', 100, 100, 1, 5), 'spend alert fires only once per day');
select test.throws($$select public.consume_ai_quota('aaaaaaaa-0000-0000-0000-00000000000a', 5)$$, 'GLOBAL_BUDGET_EXHAUSTED', 'global spend cap blocks all AI calls');
reset role;

-- ---------------------------------------------------------------- cascade deletion
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select test.ok((select count(*) from public.study_plans) = 0 and (select count(*) from public.materials) = 0
  and (select count(*) from public.student_profiles) = 0, 'account deletion cascades to all personal rows');
