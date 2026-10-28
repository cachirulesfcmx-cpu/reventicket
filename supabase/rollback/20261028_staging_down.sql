-- STAGING ROLLBACK for migrations 20261028000001..03. DESTRUCTIVE: drops all StudIA data.
-- Never run on production without an approved incident decision and a verified backup.
-- Storage objects must be removed first via the Storage API/dashboard (bucket "study-materials").
begin;
drop policy if exists "studia materials read own" on storage.objects;
drop policy if exists "studia materials upload registered" on storage.objects;
drop policy if exists "studia materials delete own" on storage.objects;
delete from storage.buckets where id = 'study-materials' and not exists (select 1 from storage.objects where bucket_id = 'study-materials');
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.my_subject_progress;
drop table if exists public.attempt_answers, public.exam_attempts, public.questions, public.material_jobs, public.materials,
  public.ai_usage_daily, public.ai_budget_daily, public.plan_limits, public.study_sessions, public.study_plans,
  public.subjects, public.curriculum_sources, public.onboarding_responses, public.guardian_consents,
  public.student_profiles, public.audit_events, public.user_profiles cascade;
drop function if exists public.handle_new_user(), public.touch_updated_at(), public.owns_student(uuid), public.owns_plan(uuid),
  public.create_student_profile(text,text,text,text,boolean), public.revoke_student_consent(uuid), public.save_onboarding(jsonb,uuid),
  public.generate_plan_sessions(uuid), public.start_quiz(text,int,uuid,uuid), public.submit_quiz(uuid,jsonb), public.family_report(),
  public.register_material(text,text,int,uuid,uuid), public.mark_material_uploaded(uuid), public.claim_material_job(),
  public.complete_material_job(uuid,text,text), public.consume_ai_quota(uuid,numeric),
  public.record_ai_usage(uuid,int,int,numeric,numeric), public.export_my_data(), public.admin_overview();
delete from supabase_migrations.schema_migrations where version like '20261028%';
commit;
