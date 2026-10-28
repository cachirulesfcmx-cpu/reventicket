// Typed data access. Everything runs as the signed-in user; authorization is enforced
// by RLS and SECURITY DEFINER functions in Postgres, never by this file.
import { requireSupabase } from './supabase';
import { parseTopics, type PlanInput } from './validation';
import type { Answers } from './onboarding';
import { toServerPayload } from './onboarding';

const unwrap = <T>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

// ---------------------------------------------------------------- family
export type Student = { id: string; display_name: string; school_level: string; grade_label: string; created_at: string };

export async function listStudents(): Promise<Student[]> {
  return unwrap(await requireSupabase().from('student_profiles')
    .select('id,display_name,school_level,grade_label,created_at').order('created_at'));
}

export async function createStudent(input: { name: string; level: string; grade: string; consent: boolean; noticeVersion: string }) {
  return unwrap<string>(await requireSupabase().rpc('create_student_profile', {
    p_display_name: input.name, p_school_level: input.level, p_grade_label: input.grade,
    p_privacy_notice_version: input.noticeVersion, p_consent: input.consent,
  }));
}

export async function deleteStudent(id: string) {
  unwrap(await requireSupabase().from('student_profiles').delete().eq('id', id));
}

export type FamilyRow = { studentId: string; displayName: string; schoolLevel: string; grade: string;
  activePlans: number; completedSessions: number; attempts: number; avgScore: number | null };

export async function familyReport(): Promise<FamilyRow[]> {
  return unwrap(await requireSupabase().rpc('family_report'));
}

export async function saveOnboarding(a: Answers, studentId?: string | null) {
  return unwrap(await requireSupabase().rpc('save_onboarding', { p_answers: toServerPayload(a), p_student: studentId ?? null }));
}

// ---------------------------------------------------------------- plans
export type Plan = { id: string; title: string; subject_slug: string; topics: string[]; exam_date: string | null;
  target_score: number | null; status: 'active' | 'completed' | 'archived'; student_id: string | null; created_at: string };
export type Session = { id: string; plan_id: string; position: number; topic: string; kind: string;
  scheduled_for: string | null; status: 'pending' | 'in_progress' | 'completed' };

export async function listPlans(): Promise<Plan[]> {
  return unwrap(await requireSupabase().from('study_plans').select('*').neq('status', 'archived').order('created_at', { ascending: false }));
}

export async function getPlan(id: string): Promise<{ plan: Plan; sessions: Session[] }> {
  const sb = requireSupabase();
  const plan = unwrap<Plan>(await sb.from('study_plans').select('*').eq('id', id).single());
  const sessions = unwrap<Session[]>(await sb.from('study_sessions').select('*').eq('plan_id', id).order('position'));
  return { plan, sessions };
}

export async function createPlan(input: PlanInput & { studentId?: string | null }, userId: string): Promise<string> {
  const sb = requireSupabase();
  const plan = unwrap<{ id: string }>(await sb.from('study_plans').insert({
    user_id: userId, student_id: input.studentId ?? null, title: input.title.trim(), subject_slug: input.subject,
    topics: parseTopics(input.topics), exam_date: input.examDate.trim() || null, target_score: input.targetScore ?? null,
  }).select('id').single());
  unwrap(await sb.rpc('generate_plan_sessions', { p_plan: plan.id }));
  return plan.id;
}

export async function setPlanStatus(id: string, status: Plan['status']) {
  unwrap(await requireSupabase().from('study_plans').update({ status }).eq('id', id));
}

export async function deletePlan(id: string) {
  unwrap(await requireSupabase().from('study_plans').delete().eq('id', id));
}

export async function setSessionStatus(id: string, status: Session['status']) {
  unwrap(await requireSupabase().from('study_sessions')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id));
}

// ---------------------------------------------------------------- assessment
export type QuizQuestion = { id: string; prompt: string; options: string[]; contentStatus: 'demo' | 'validated' };
export type Quiz = { attemptId: string; includesDemo: boolean; questions: QuizQuestion[] };
export type QuizResult = { correct: number; total: number; score: number; includesDemo: boolean;
  review: { questionId: string; prompt: string; options: string[]; selectedIndex: number | null; correctIndex: number; isCorrect: boolean; explanation: string }[] };

export async function startQuiz(subject: string, count = 5, studentId?: string | null, planId?: string | null): Promise<Quiz> {
  return unwrap(await requireSupabase().rpc('start_quiz', { p_subject: subject, p_count: count, p_student: studentId ?? null, p_plan: planId ?? null }));
}

export async function submitQuiz(attemptId: string, answers: Record<string, number>): Promise<QuizResult> {
  return unwrap(await requireSupabase().rpc('submit_quiz', { p_attempt: attemptId, p_answers: answers }));
}

export type SubjectProgress = { subject_slug: string; student_id: string | null; attempts: number; avg_score: number; last_attempt_at: string; includes_demo: boolean };

export async function myProgress(): Promise<SubjectProgress[]> {
  return unwrap(await requireSupabase().from('my_subject_progress').select('*'));
}

// ---------------------------------------------------------------- materials
export type Material = { id: string; title: string; mime_type: string; size_bytes: number; status: string;
  error_code: string | null; created_at: string; storage_path: string };

export async function listMaterials(): Promise<Material[]> {
  return unwrap(await requireSupabase().from('materials')
    .select('id,title,mime_type,size_bytes,status,error_code,created_at,storage_path').order('created_at', { ascending: false }));
}

/** register (server picks random path) → upload to private bucket → server verifies object. */
export async function uploadMaterial(file: { uri: string; title: string; mimeType: string; size: number; blob?: Blob }) {
  const sb = requireSupabase();
  const reg = unwrap<{ id: string; path: string }>(await sb.rpc('register_material', {
    p_title: file.title, p_mime: file.mimeType, p_size: file.size,
  }));
  const body = file.blob ?? (await (await fetch(file.uri)).arrayBuffer());
  const { error } = await sb.storage.from('study-materials').upload(reg.path, body, { contentType: file.mimeType, upsert: false });
  if (error) {
    await sb.from('materials').delete().eq('id', reg.id);
    throw new Error(error.message);
  }
  unwrap(await sb.rpc('mark_material_uploaded', { p_material: reg.id }));
  return reg.id;
}

export async function deleteMaterial(m: Pick<Material, 'id' | 'storage_path'>) {
  const sb = requireSupabase();
  const { error } = await sb.storage.from('study-materials').remove([m.storage_path]);
  if (error) throw new Error(error.message);
  unwrap(await sb.from('materials').delete().eq('id', m.id));
}

export async function materialUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from('study-materials').createSignedUrl(path, 300);
  if (error || !data) throw new Error(error?.message ?? 'signed_url_failed');
  return data.signedUrl;
}

// ---------------------------------------------------------------- tutor
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function functionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response })?.context;
  try {
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    if (body?.error) return new Error(body.error);
  } catch { /* fall through */ }
  return new Error((error as Error)?.message ?? 'tutor_unavailable');
}

export async function askTutor(messages: ChatMessage[], opts: { studentId?: string | null; materialId?: string | null } = {}) {
  const { data, error } = await requireSupabase().functions.invoke('tutor', {
    body: { messages: messages.slice(-12), studentId: opts.studentId ?? undefined, materialId: opts.materialId ?? undefined },
  });
  if (error) throw await functionError(error);
  if (typeof data?.answer !== 'string') throw new Error('tutor_unavailable');
  return data as { answer: string; remaining?: number | null; safety?: string };
}

// ---------------------------------------------------------------- privacy
export async function exportMyData(): Promise<unknown> {
  return unwrap(await requireSupabase().rpc('export_my_data'));
}

export async function deleteMyAccount() {
  const sb = requireSupabase();
  const { error } = await sb.functions.invoke('delete-account', { body: { confirm: 'ELIMINAR' } });
  if (error) throw await functionError(error);
  await sb.auth.signOut();
}
