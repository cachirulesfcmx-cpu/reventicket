-- StudIA · 0003 private materials + async extraction queue, atomic AI quotas,
-- spend budget, data export and minimal admin tooling.

-- ---------------------------------------------------------------------------
-- Materials. The object path is generated server-side (random UUID), and an
-- upload is only accepted for a pre-registered pending row owned by the caller.
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.student_profiles(id) on delete cascade,
  plan_id uuid references public.study_plans(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp','text/plain')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  status text not null default 'pending_upload'
    check (status in ('pending_upload','uploaded','processing','ready','failed')),
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 200000),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index materials_user_idx on public.materials (user_id, created_at desc);
alter table public.materials enable row level security;
create trigger materials_touch before update on public.materials
  for each row execute function public.touch_updated_at();

create policy "materials own select" on public.materials for select to authenticated
  using (user_id = (select auth.uid()));
create policy "materials own update" on public.materials for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "materials own delete" on public.materials for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.materials from anon, authenticated;
grant select, delete on public.materials to authenticated;
grant update (title) on public.materials to authenticated;

create table public.material_jobs (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null unique references public.materials(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
create index material_jobs_queue_idx on public.material_jobs (status, run_after);
alter table public.material_jobs enable row level security;
revoke all on public.material_jobs from anon, authenticated;

create or replace function public.register_material(
  p_title text, p_mime text, p_size int, p_student uuid default null, p_plan uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ext text;
  path text;
  mid uuid;
begin
  if uid is null then raise exception 'STUDIA_AUTH_REQUIRED' using errcode = '28000'; end if;
  ext := case p_mime
    when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
    when 'image/webp' then 'webp' when 'text/plain' then 'txt' end;
  if ext is null then raise exception 'STUDIA_UNSUPPORTED_TYPE' using errcode = '22023'; end if;
  if p_size is null or p_size < 1 or p_size > 10485760 then
    raise exception 'STUDIA_FILE_TOO_LARGE' using errcode = '22023';
  end if;
  if p_student is not null and not public.owns_student(p_student) then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_plan is not null and not public.owns_plan(p_plan) then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (select count(*) from public.materials where user_id = uid) >= 200 then
    raise exception 'STUDIA_MATERIAL_LIMIT' using errcode = 'P0001';
  end if;
  if (select count(*) from public.materials where user_id = uid and created_at > now() - interval '1 day') >= 40 then
    raise exception 'STUDIA_RATE_LIMITED' using errcode = 'P0001';
  end if;
  mid := gen_random_uuid();
  path := uid::text || '/' || gen_random_uuid()::text || '.' || ext;
  insert into public.materials (id, user_id, student_id, plan_id, title, storage_path, mime_type, size_bytes)
  values (mid, uid, p_student, p_plan, btrim(p_title), path, p_mime, p_size);
  return jsonb_build_object('id', mid, 'path', path);
end;
$$;
revoke all on function public.register_material(text, text, int, uuid, uuid) from public, anon;
grant execute on function public.register_material(text, text, int, uuid, uuid) to authenticated;

-- Confirms the object really exists with the declared type/size, then enqueues extraction.
create or replace function public.mark_material_uploaded(p_material uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m record;
  obj record;
begin
  select * into m from public.materials
   where id = p_material and user_id = (select auth.uid()) and status = 'pending_upload' for update;
  if not found then raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002'; end if;
  select o.metadata into obj from storage.objects o
   where o.bucket_id = 'study-materials' and o.name = m.storage_path;
  if not found then raise exception 'STUDIA_UPLOAD_MISSING' using errcode = 'P0002'; end if;
  if coalesce((obj.metadata ->> 'size')::bigint, 0) > 10485760
     or coalesce(obj.metadata ->> 'mimetype', '') <> m.mime_type then
    update public.materials set status = 'failed', error_code = 'UPLOAD_MISMATCH' where id = m.id;
    return;
  end if;
  update public.materials set status = 'uploaded' where id = m.id;
  insert into public.material_jobs (material_id) values (m.id) on conflict (material_id) do nothing;
end;
$$;
revoke all on function public.mark_material_uploaded(uuid) from public, anon;
grant execute on function public.mark_material_uploaded(uuid) to authenticated;

-- Worker API (service_role only).
create or replace function public.claim_material_job()
returns table (job_id uuid, material_id uuid, storage_path text, mime_type text, attempts int)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with next_job as (
    select j.id from public.material_jobs j
     where (j.status = 'queued' and j.run_after <= now())
        or (j.status = 'running' and j.locked_at < now() - interval '15 minutes')
     order by j.created_at
     for update skip locked
     limit 1
  ), claimed as (
    update public.material_jobs j
       set status = 'running', locked_at = now(), attempts = j.attempts + 1
      from next_job where j.id = next_job.id
    returning j.id, j.material_id, j.attempts
  ), touched as (
    update public.materials m set status = 'processing'
      from claimed where m.id = claimed.material_id
    returning m.id, m.storage_path, m.mime_type
  )
  select c.id, c.material_id, t.storage_path, t.mime_type, c.attempts
  from claimed c join touched t on t.id = c.material_id;
end;
$$;

create or replace function public.complete_material_job(p_job uuid, p_text text, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  j record;
begin
  select * into j from public.material_jobs where id = p_job for update;
  if not found then return; end if;
  if p_error is null then
    update public.material_jobs set status = 'done', last_error = null where id = p_job;
    update public.materials set status = 'ready', extracted_text = left(p_text, 200000), error_code = null
     where id = j.material_id;
  elsif j.attempts >= 3 then
    update public.material_jobs set status = 'failed', last_error = left(p_error, 200) where id = p_job;
    update public.materials set status = 'failed', error_code = left(p_error, 60) where id = j.material_id;
  else
    update public.material_jobs
       set status = 'queued', last_error = left(p_error, 200),
           run_after = now() + make_interval(mins => 2 * j.attempts * j.attempts)
     where id = p_job;
    update public.materials set status = 'uploaded' where id = j.material_id;
  end if;
end;
$$;
revoke all on function public.claim_material_job() from public, anon, authenticated;
revoke all on function public.complete_material_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_material_job() to service_role;
grant execute on function public.complete_material_job(uuid, text, text) to service_role;

-- Private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials', 'study-materials', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "studia materials read own" on storage.objects for select to authenticated
  using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "studia materials upload registered" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'study-materials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.materials m
                 where m.storage_path = name and m.user_id = (select auth.uid()) and m.status = 'pending_upload')
  );
create policy "studia materials delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- AI quotas (atomic) and global spend budget.
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  plan text primary key,
  daily_requests int not null check (daily_requests >= 0),
  max_output_tokens int not null check (max_output_tokens > 0)
);
insert into public.plan_limits values ('free', 20, 700), ('plus', 300, 1200), ('school', 200, 1000);
alter table public.plan_limits enable row level security;
create policy "limits readable" on public.plan_limits for select to authenticated using (true);
revoke all on public.plan_limits from anon, authenticated;
grant select on public.plan_limits to authenticated;

create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  requests int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage_daily enable row level security;
create policy "usage own select" on public.ai_usage_daily for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ai_usage_daily from anon, authenticated;
grant select on public.ai_usage_daily to authenticated;

create table public.ai_budget_daily (
  day date primary key default current_date,
  requests int not null default 0,
  est_cost_usd numeric(12,4) not null default 0,
  alert_sent_at timestamptz
);
alter table public.ai_budget_daily enable row level security;
revoke all on public.ai_budget_daily from anon, authenticated;

-- Returns the remaining request count, or raises when the user or global budget is exhausted.
create or replace function public.consume_ai_quota(p_user uuid, p_global_cap_usd numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  lim record;
  used int;
begin
  select pl.daily_requests, pl.max_output_tokens into lim
    from public.user_profiles up join public.plan_limits pl on pl.plan = up.plan
   where up.id = p_user;
  if not found then raise exception 'STUDIA_PROFILE_MISSING' using errcode = 'P0002'; end if;
  if coalesce((select est_cost_usd from public.ai_budget_daily where day = current_date), 0) >= p_global_cap_usd then
    raise exception 'STUDIA_GLOBAL_BUDGET_EXHAUSTED' using errcode = 'P0001';
  end if;
  insert into public.ai_usage_daily as u (user_id, day, requests) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set requests = u.requests + 1
    where u.requests < lim.daily_requests
  returning u.requests into used;
  if used is null or used > lim.daily_requests then
    raise exception 'STUDIA_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  return jsonb_build_object('remaining', lim.daily_requests - used, 'maxOutputTokens', lim.max_output_tokens);
end;
$$;

-- Records token usage and estimated cost; returns true when the alert threshold is crossed for the first time.
create or replace function public.record_ai_usage(
  p_user uuid, p_input int, p_output int, p_cost_usd numeric, p_alert_threshold_usd numeric
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  b record;
begin
  update public.ai_usage_daily
     set input_tokens = input_tokens + greatest(p_input, 0), output_tokens = output_tokens + greatest(p_output, 0)
   where user_id = p_user and day = current_date;
  insert into public.ai_budget_daily as d (day, requests, est_cost_usd) values (current_date, 1, greatest(p_cost_usd, 0))
  on conflict (day) do update set requests = d.requests + 1, est_cost_usd = d.est_cost_usd + greatest(p_cost_usd, 0)
  returning * into b;
  if b.est_cost_usd >= p_alert_threshold_usd and b.alert_sent_at is null then
    update public.ai_budget_daily set alert_sent_at = now() where day = b.day;
    insert into public.audit_events (event_type, target_type, target_id)
    values ('ai_budget_alert', 'ai_budget_daily', b.day::text);
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, numeric) from public, anon, authenticated;
revoke all on function public.record_ai_usage(uuid, int, int, numeric, numeric) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, numeric) to service_role;
grant execute on function public.record_ai_usage(uuid, int, int, numeric, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- Data portability (ARCO: acceso) and admin overview.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exportedAt', now(),
    'profile', (select to_jsonb(p) - 'is_admin' from public.user_profiles p where p.id = (select auth.uid())),
    'students', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.student_profiles s where s.guardian_id = (select auth.uid())),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.guardian_consents c where c.guardian_id = (select auth.uid())),
    'onboarding', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from public.onboarding_responses o where o.user_id = (select auth.uid())),
    'plans', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.study_plans p where p.user_id = (select auth.uid())),
    'sessions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.study_sessions s where s.user_id = (select auth.uid())),
    'attempts', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.exam_attempts a where a.user_id = (select auth.uid())),
    'materials', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.materials m where m.user_id = (select auth.uid())),
    'aiUsage', (select coalesce(jsonb_agg(to_jsonb(u)), '[]') from public.ai_usage_daily u where u.user_id = (select auth.uid()))
  );
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_profiles where id = (select auth.uid()) and is_admin) then
    raise exception 'STUDIA_FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from public.user_profiles),
    'students', (select count(*) from public.student_profiles),
    'materialsFailed', (select count(*) from public.materials where status = 'failed'),
    'jobsQueued', (select count(*) from public.material_jobs where status in ('queued','running')),
    'aiToday', (select to_jsonb(b) from public.ai_budget_daily b where b.day = current_date)
  );
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
