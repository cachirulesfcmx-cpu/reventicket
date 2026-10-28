-- StudIA · 0002 curriculum catalog, plans, sessions, question bank and deterministic grading.

-- ---------------------------------------------------------------------------
-- Curriculum catalog (versioned, every validated item must cite a source).
-- Only generic subject names are seeded; no official SEP content is invented.
-- ---------------------------------------------------------------------------
create table public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  url text,
  license text not null,
  retrieved_at date,
  reviewed_by text,
  reviewed_at date,
  created_at timestamptz not null default now()
);
alter table public.curriculum_sources enable row level security;
create policy "sources readable" on public.curriculum_sources for select to authenticated using (true);
revoke all on public.curriculum_sources from anon, authenticated;
grant select on public.curriculum_sources to authenticated;

create table public.subjects (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name_es text not null,
  catalog_version text not null default '2026.10-draft',
  content_status text not null default 'draft' check (content_status in ('draft','validated')),
  source_id uuid references public.curriculum_sources(id),
  sort_order int not null default 100,
  constraint validated_needs_source check (content_status = 'draft' or source_id is not null)
);
alter table public.subjects enable row level security;
create policy "subjects readable" on public.subjects for select to anon, authenticated using (true);
revoke all on public.subjects from anon, authenticated;
grant select on public.subjects to anon, authenticated;

insert into public.subjects (slug, name_es, sort_order) values
  ('matematicas','Matemáticas',1), ('espanol','Español',2), ('fisica','Física',3),
  ('quimica','Química',4), ('biologia','Biología',5), ('historia','Historia',6),
  ('geografia','Geografía',7), ('ingles','Inglés',8), ('informatica','Informática',9),
  ('civismo','Formación cívica y ética',10), ('economia','Economía',11),
  ('filosofia','Filosofía',12), ('psicologia','Psicología',13), ('frances','Francés',14),
  ('otra','Otra materia',99);

-- ---------------------------------------------------------------------------
-- Study plans and sessions.
-- ---------------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.student_profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  subject_slug text not null references public.subjects(slug),
  topics text[] not null default '{}' check (cardinality(topics) <= 30),
  exam_date date,
  target_score int check (target_score between 0 and 100),
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_plans_user_idx on public.study_plans (user_id, status);
create index study_plans_student_idx on public.study_plans (student_id);
alter table public.study_plans enable row level security;
create trigger study_plans_touch before update on public.study_plans
  for each row execute function public.touch_updated_at();

create policy "plans own select" on public.study_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "plans own insert" on public.study_plans for insert to authenticated
  with check (user_id = (select auth.uid()) and (student_id is null or public.owns_student(student_id)));
create policy "plans own update" on public.study_plans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (student_id is null or public.owns_student(student_id)));
create policy "plans own delete" on public.study_plans for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.study_plans from anon, authenticated;
grant select, insert, update, delete on public.study_plans to authenticated;

create or replace function public.owns_plan(p_plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_plans where id = p_plan and user_id = (select auth.uid()));
$$;
revoke all on function public.owns_plan(uuid) from public, anon;
grant execute on function public.owns_plan(uuid) to authenticated;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  topic text not null check (char_length(btrim(topic)) between 1 and 120),
  kind text not null default 'learn' check (kind in ('diagnostic','learn','practice','review','mock_exam')),
  scheduled_for date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index study_sessions_plan_idx on public.study_sessions (plan_id, position);
create index study_sessions_user_idx on public.study_sessions (user_id);
alter table public.study_sessions enable row level security;
-- The plan must belong to the caller, closing the cross-tenant plan_id hole.
create policy "sessions own select" on public.study_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "sessions own insert" on public.study_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_plan(plan_id));
create policy "sessions own update" on public.study_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_plan(plan_id));
create policy "sessions own delete" on public.study_sessions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.study_sessions from anon, authenticated;
grant select, insert, delete on public.study_sessions to authenticated;
grant update (status, completed_at, scheduled_for, topic, position) on public.study_sessions to authenticated;

-- Deterministic planner: spreads sessions between today and the exam date.
create or replace function public.generate_plan_sessions(p_plan uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  plan record;
  topic_list text[];
  days int;
  i int := 0;
  total int;
  t text;
  kinds text[];
begin
  select * into plan from public.study_plans where id = p_plan and user_id = (select auth.uid());
  if not found then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.study_sessions where plan_id = p_plan) then
    raise exception 'STUDIA_PLAN_ALREADY_GENERATED' using errcode = 'P0001';
  end if;
  topic_list := case when cardinality(plan.topics) > 0 then plan.topics else array['Repaso general'] end;
  total := cardinality(topic_list) * 2 + 2;
  days := greatest(coalesce(plan.exam_date - current_date, 14), 1);

  insert into public.study_sessions (plan_id, user_id, position, topic, kind, scheduled_for)
  values (p_plan, plan.user_id, 0, 'Diagnóstico inicial', 'diagnostic', current_date);
  foreach t in array topic_list loop
    i := i + 1;
    kinds := array['learn','practice'];
    insert into public.study_sessions (plan_id, user_id, position, topic, kind, scheduled_for)
    select p_plan, plan.user_id, (i * 2 + k.ord - 2)::int, t, k.kind,
           current_date + least(days - 1, ((i * 2 + k.ord - 2) * days) / total)::int
    from unnest(kinds) with ordinality as k(kind, ord);
  end loop;
  insert into public.study_sessions (plan_id, user_id, position, topic, kind, scheduled_for)
  values (p_plan, plan.user_id, total - 1, 'Simulacro final', 'mock_exam', current_date + greatest(days - 1, 0));
  return total;
end;
$$;
revoke all on function public.generate_plan_sessions(uuid) from public, anon;
grant execute on function public.generate_plan_sessions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Question bank. Correct answers are never readable by clients.
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_slug text not null references public.subjects(slug),
  level text check (level in ('primaria','secundaria','preparatoria')),
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index int not null,
  explanation text not null,
  content_status text not null default 'demo' check (content_status in ('demo','validated')),
  source_id uuid references public.curriculum_sources(id),
  created_at timestamptz not null default now(),
  constraint correct_in_range check (correct_index >= 0 and correct_index < jsonb_array_length(options)),
  constraint validated_question_needs_source check (content_status = 'demo' or source_id is not null)
);
create index questions_subject_idx on public.questions (subject_slug, content_status);
alter table public.questions enable row level security;
revoke all on public.questions from anon, authenticated;

-- Demo items, explicitly labelled as demo content (not official exam content).
insert into public.questions (subject_slug, level, prompt, options, correct_index, explanation) values
  ('matematicas','primaria','¿Cuál es el resultado de 3 × 8?','["11","24","38","21"]',1,'Multiplicar 3 por 8 equivale a sumar 8 tres veces: 8 + 8 + 8 = 24.'),
  ('matematicas','primaria','¿Cuánto es 1/2 + 1/4?','["2/6","3/4","1/6","2/4"]',1,'1/2 equivale a 2/4; 2/4 + 1/4 = 3/4.'),
  ('matematicas','secundaria','Si 2x + 3 = 11, ¿cuánto vale x?','["3","4","7","8"]',1,'2x = 11 − 3 = 8, entonces x = 8 ÷ 2 = 4.'),
  ('matematicas','secundaria','¿Cuál es el 20 % de 150?','["15","20","30","75"]',2,'20 % es 0.2; 0.2 × 150 = 30.'),
  ('espanol','primaria','¿Cuál de estas palabras es un sustantivo?','["Correr","Azul","Escuela","Rápidamente"]',2,'“Escuela” nombra un lugar; por eso es un sustantivo.'),
  ('biologia','primaria','¿Qué órgano bombea la sangre en el cuerpo humano?','["Pulmón","Corazón","Hígado","Riñón"]',1,'El corazón es un músculo que bombea la sangre por los vasos sanguíneos.'),
  ('fisica','secundaria','Un objeto recorre 100 m en 20 s a velocidad constante. ¿Cuál es su velocidad?','["2 m/s","5 m/s","20 m/s","120 m/s"]',1,'v = d / t = 100 m ÷ 20 s = 5 m/s.'),
  ('quimica','secundaria','¿Cuál es el símbolo químico del oxígeno?','["Ox","O","Og","Om"]',1,'En la tabla periódica, el oxígeno se representa con la letra O.');

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.student_profiles(id) on delete cascade,
  plan_id uuid references public.study_plans(id) on delete set null,
  subject_slug text not null references public.subjects(slug),
  question_ids uuid[] not null,
  total int not null default 0,
  correct int not null default 0,
  score numeric(5,2),
  includes_demo boolean not null default true,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, submitted_at desc);
alter table public.exam_attempts enable row level security;
create policy "attempts own select" on public.exam_attempts for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.exam_attempts from anon, authenticated;
grant select on public.exam_attempts to authenticated;

create table public.attempt_answers (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index int,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);
alter table public.attempt_answers enable row level security;
create policy "answers own select" on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));
revoke all on public.attempt_answers from anon, authenticated;
grant select on public.attempt_answers to authenticated;

-- Start a quiz: returns questions WITHOUT the answer key and records the attempt.
create or replace function public.start_quiz(p_subject text, p_count int default 5, p_student uuid default null, p_plan uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ids uuid[];
  attempt uuid;
  demo boolean;
begin
  if uid is null then raise exception 'STUDIA_AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_student is not null and not public.owns_student(p_student) then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_plan is not null and not public.owns_plan(p_plan) then
    raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  select array_agg(id), bool_or(content_status = 'demo') into ids, demo
  from (select id, content_status from public.questions where subject_slug = p_subject
        order by random() limit least(greatest(p_count, 1), 20)) q;
  if ids is null then
    raise exception 'STUDIA_NO_QUESTIONS' using errcode = 'P0002';
  end if;
  insert into public.exam_attempts (user_id, student_id, plan_id, subject_slug, question_ids, total, includes_demo)
  values (uid, p_student, p_plan, p_subject, ids, cardinality(ids), demo)
  returning id into attempt;
  return jsonb_build_object(
    'attemptId', attempt,
    'includesDemo', demo,
    'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options,
                                                      'contentStatus', q.content_status) order by o.ord)
                  from unnest(ids) with ordinality o(id, ord) join public.questions q on q.id = o.id)
  );
end;
$$;
revoke all on function public.start_quiz(text, int, uuid, uuid) from public, anon;
grant execute on function public.start_quiz(text, int, uuid, uuid) to authenticated;

-- Deterministic server-side grading. Answers: {"<question uuid>": <selected index>}.
create or replace function public.submit_quiz(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  att record;
  n_correct int;
begin
  select * into att from public.exam_attempts
   where id = p_attempt and user_id = (select auth.uid()) for update;
  if not found then raise exception 'STUDIA_NOT_FOUND' using errcode = 'P0002'; end if;
  if att.submitted_at is not null then raise exception 'STUDIA_ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'STUDIA_INVALID_ANSWERS' using errcode = '22023'; end if;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select att.id, x.id, x.selected, coalesce(x.selected = x.correct_index, false)
  from (
    select q.id, q.correct_index,
           case when jsonb_typeof(p_answers -> q.id::text) = 'number'
                 and (p_answers ->> q.id::text) ~ '^[0-9]{1,2}$'
                then (p_answers ->> q.id::text)::int end as selected
    from public.questions q where q.id = any(att.question_ids)
  ) x;

  select count(*) filter (where is_correct) into n_correct from public.attempt_answers where attempt_id = att.id;
  update public.exam_attempts
     set correct = n_correct,
         score = round(100.0 * n_correct / nullif(total, 0), 2),
         submitted_at = now()
   where id = att.id;
  return jsonb_build_object(
    'attemptId', att.id, 'correct', n_correct, 'total', att.total,
    'score', round(100.0 * n_correct / nullif(att.total, 0), 2), 'includesDemo', att.includes_demo,
    'review', (select jsonb_agg(jsonb_build_object('questionId', q.id, 'prompt', q.prompt, 'options', q.options,
                     'selectedIndex', a.selected_index, 'correctIndex', q.correct_index,
                     'isCorrect', a.is_correct, 'explanation', q.explanation) order by o.ord)
               from unnest(att.question_ids) with ordinality o(id, ord)
               join public.questions q on q.id = o.id
               join public.attempt_answers a on a.attempt_id = att.id and a.question_id = q.id)
  );
end;
$$;
revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Progress per subject computed from real graded attempts (no invented percentages).
create or replace view public.my_subject_progress with (security_invoker = true) as
  select a.user_id, a.student_id, a.subject_slug,
         count(*) as attempts,
         round(avg(a.score), 1) as avg_score,
         max(a.submitted_at) as last_attempt_at,
         bool_or(a.includes_demo) as includes_demo
  from public.exam_attempts a
  where a.submitted_at is not null
  group by a.user_id, a.student_id, a.subject_slug;
revoke all on public.my_subject_progress from anon, authenticated;
grant select on public.my_subject_progress to authenticated;

-- Family report for a guardian: aggregates only, no conversation or document content.
create or replace function public.family_report()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'studentId', s.id, 'displayName', s.display_name, 'schoolLevel', s.school_level, 'grade', s.grade_label,
    'activePlans', (select count(*) from public.study_plans p where p.student_id = s.id and p.status = 'active'),
    'completedSessions', (select count(*) from public.study_sessions ss join public.study_plans p on p.id = ss.plan_id
                           where p.student_id = s.id and ss.status = 'completed'),
    'attempts', (select count(*) from public.exam_attempts a where a.student_id = s.id and a.submitted_at is not null),
    'avgScore', (select round(avg(a.score), 1) from public.exam_attempts a where a.student_id = s.id and a.submitted_at is not null)
  ) order by s.created_at), '[]'::jsonb)
  from public.student_profiles s
  where s.guardian_id = (select auth.uid());
$$;
revoke all on function public.family_report() from public, anon;
grant execute on function public.family_report() to authenticated;
