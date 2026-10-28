-- StudIA · 0001 identity, family, consent and onboarding.
-- Principles: deny by default, RLS on every table, privileged writes only through
-- SECURITY DEFINER functions that re-check the caller. Never trust client-sent role,
-- plan, age or consent flags without server validation.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Account holders (always adults). Learners who are minors live in student_profiles
-- and are managed by a guardian account.
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  account_type text not null default 'guardian'
    check (account_type in ('guardian','adult_student','teacher','other')),
  plan text not null default 'free' check (plan in ('free','plus','school')),
  is_admin boolean not null default false,
  adult_attested_at timestamptz not null,
  privacy_notice_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;

create policy "profile select own" on public.user_profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profile update own" on public.user_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Column-level privileges: clients may only edit display_name and account_type.
-- plan / is_admin / attestation columns are server-owned.
revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name, account_type) on public.user_profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger user_profiles_touch before update on public.user_profiles
  for each row execute function public.touch_updated_at();

-- Signup bootstrap. The account holder must attest to being an adult and accept a
-- privacy-notice version; otherwise signup is rejected server-side.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  kind text := coalesce(meta ->> 'account_type', 'guardian');
begin
  if coalesce(meta ->> 'adult_attested', 'false') <> 'true' then
    raise exception 'STUDIA_ADULT_ATTESTATION_REQUIRED' using errcode = 'P0001';
  end if;
  if coalesce(meta ->> 'privacy_notice_version', '') = '' then
    raise exception 'STUDIA_PRIVACY_NOTICE_REQUIRED' using errcode = 'P0001';
  end if;
  if kind not in ('guardian','adult_student','teacher','other') then
    kind := 'guardian';
  end if;
  insert into public.user_profiles (id, display_name, account_type, adult_attested_at, privacy_notice_version)
  values (
    new.id,
    left(coalesce(meta ->> 'display_name', ''), 80),
    kind,
    now(),
    left(meta ->> 'privacy_notice_version', 40)
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Student profiles: created only through create_student_profile(), which records
-- guardian consent atomically. Direct INSERT is not granted.
-- ---------------------------------------------------------------------------
create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  school_level text not null check (school_level in ('primaria','secundaria','preparatoria')),
  grade_label text not null check (char_length(btrim(grade_label)) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_profiles_guardian_idx on public.student_profiles (guardian_id);
alter table public.student_profiles enable row level security;
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

create policy "guardian reads own students" on public.student_profiles
  for select to authenticated using (guardian_id = (select auth.uid()));
create policy "guardian updates own students" on public.student_profiles
  for update to authenticated using (guardian_id = (select auth.uid())) with check (guardian_id = (select auth.uid()));
create policy "guardian deletes own students" on public.student_profiles
  for delete to authenticated using (guardian_id = (select auth.uid()));

revoke all on public.student_profiles from anon, authenticated;
grant select, delete on public.student_profiles to authenticated;
grant update (display_name, school_level, grade_label) on public.student_profiles to authenticated;

create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  privacy_notice_version text not null,
  method text not null default 'in_app_attestation' check (method in ('in_app_attestation','verified')),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index guardian_consents_student_idx on public.guardian_consents (student_id);
create index guardian_consents_guardian_idx on public.guardian_consents (guardian_id);
alter table public.guardian_consents enable row level security;
create policy "guardian reads own consents" on public.guardian_consents
  for select to authenticated using (guardian_id = (select auth.uid()));
revoke all on public.guardian_consents from anon, authenticated;
grant select on public.guardian_consents to authenticated;

-- True when the caller is the guardian of the student and consent is active.
create or replace function public.owns_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.student_profiles s
    join public.guardian_consents c on c.student_id = s.id and c.revoked_at is null
    where s.id = p_student and s.guardian_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_student(uuid) from public, anon;
grant execute on function public.owns_student(uuid) to authenticated;

create or replace function public.create_student_profile(
  p_display_name text,
  p_school_level text,
  p_grade_label text,
  p_privacy_notice_version text,
  p_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception 'STUDIA_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_consent is distinct from true then
    raise exception 'STUDIA_GUARDIAN_CONSENT_REQUIRED' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_privacy_notice_version), '') = '' then
    raise exception 'STUDIA_PRIVACY_NOTICE_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_profiles where id = uid and adult_attested_at is not null) then
    raise exception 'STUDIA_ADULT_ACCOUNT_REQUIRED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.student_profiles where guardian_id = uid) >= 6 then
    raise exception 'STUDIA_STUDENT_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.student_profiles (guardian_id, display_name, school_level, grade_label)
  values (uid, btrim(p_display_name), p_school_level, btrim(p_grade_label))
  returning id into new_id;
  insert into public.guardian_consents (guardian_id, student_id, privacy_notice_version)
  values (uid, new_id, left(btrim(p_privacy_notice_version), 40));
  return new_id;
end;
$$;
revoke all on function public.create_student_profile(text, text, text, text, boolean) from public, anon;
grant execute on function public.create_student_profile(text, text, text, text, boolean) to authenticated;

create or replace function public.revoke_student_consent(p_student uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.guardian_consents
     set revoked_at = now()
   where student_id = p_student and guardian_id = (select auth.uid()) and revoked_at is null;
  if not found then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.revoke_student_consent(uuid) from public, anon;
grant execute on function public.revoke_student_consent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding answers. Stored as a validated whitelist; age is reduced to a band.
-- A minor learner's answers can only be attached to a consented student profile.
-- ---------------------------------------------------------------------------
create table public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.student_profiles(id) on delete cascade,
  answers jsonb not null,
  schema_version int not null default 1,
  updated_at timestamptz not null default now()
);
create unique index onboarding_one_per_learner
  on public.onboarding_responses (user_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.onboarding_responses enable row level security;
create policy "onboarding select own" on public.onboarding_responses
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.onboarding_responses from anon, authenticated;
grant select on public.onboarding_responses to authenticated;

create or replace function public.save_onboarding(p_answers jsonb, p_student uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  clean jsonb;
  band text := p_answers ->> 'ageBand';
  rid uuid;
begin
  if uid is null then
    raise exception 'STUDIA_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'STUDIA_INVALID_ANSWERS' using errcode = '22023';
  end if;
  if band not in ('under_13','13_17','18_plus') then
    raise exception 'STUDIA_INVALID_AGE_BAND' using errcode = '22023';
  end if;
  -- Server-side parental safeguard: minor learners must be a consented student profile.
  if band <> '18_plus' and (p_student is null or not public.owns_student(p_student)) then
    raise exception 'STUDIA_MINOR_REQUIRES_GUARDIAN_PROFILE' using errcode = 'P0001';
  end if;
  if p_student is not null and not public.owns_student(p_student) then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (p_answers ->> 'role') not in ('student','guardian','teacher','other')
     or (p_answers ->> 'need') not in ('upcoming_exam','better_grades','official_exam')
     or (p_answers ->> 'goal') not in ('pass','good','excellent')
     or (p_answers ->> 'materials') not in ('have_notes','no_notes')
     or (p_answers ->> 'prepMode') not in ('create','join')
     or (p_answers ->> 'voice') not in ('luna','sol','nova','text_only') then
    raise exception 'STUDIA_INVALID_ANSWERS' using errcode = '22023';
  end if;
  clean := jsonb_build_object(
    'role', p_answers ->> 'role',
    'voice', p_answers ->> 'voice',
    'ageBand', band,
    'need', p_answers ->> 'need',
    'prepMode', p_answers ->> 'prepMode',
    'examDate', case when (p_answers ->> 'examDate') ~ '^\d{4}-\d{2}-\d{2}$' then p_answers ->> 'examDate' end,
    'subject', left(coalesce(p_answers ->> 'subject', ''), 60),
    'goal', p_answers ->> 'goal',
    'concern', left(coalesce(p_answers ->> 'concern', ''), 40),
    'materials', p_answers ->> 'materials'
  );
  insert into public.onboarding_responses (user_id, student_id, answers)
  values (uid, p_student, clean)
  on conflict (user_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set answers = excluded.answers, updated_at = now()
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.save_onboarding(jsonb, uuid) from public, anon;
grant execute on function public.save_onboarding(jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log: written only by trusted server code; never stores content.
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 60),
  target_type text,
  target_id text,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
