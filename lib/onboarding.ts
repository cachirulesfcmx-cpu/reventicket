// First-run questionnaire model. The UI is a thin view over this state machine so the
// rules (validation, minor safeguard, server payload) are unit-tested.
import { parseISODate, startOfDay } from './dates';

export type Role = 'student' | 'guardian' | 'teacher' | 'other';
export type Voice = 'luna' | 'sol' | 'nova' | 'text_only';
export type Need = 'upcoming_exam' | 'better_grades' | 'official_exam';
export type PrepMode = 'create' | 'join';
export type Goal = 'pass' | 'good' | 'excellent';
export type Concern = 'where_to_start' | 'too_much_material' | 'dont_understand' | 'no_time' | 'fear_failing';
export type MaterialsAnswer = 'have_notes' | 'no_notes';
export type AgeBand = 'under_13' | '13_17' | '18_plus';

export type Answers = {
  role: Role | null;
  voice: Voice | null;
  age: number | null;
  guardianAck: boolean;
  need: Need | null;
  prepMode: PrepMode | null;
  examDate: string | null;
  subject: string | null;
  goal: Goal | null;
  concern: Concern | null;
  materials: MaterialsAnswer | null;
};

export const EMPTY_ANSWERS: Answers = {
  role: null, voice: null, age: null, guardianAck: false, need: null, prepMode: null,
  examDate: null, subject: null, goal: null, concern: null, materials: null,
};

export const STEPS = ['role', 'voice', 'age', 'need', 'prepMode', 'examDate', 'subject', 'goal', 'concern', 'materials'] as const;
export type StepId = (typeof STEPS)[number];

export const MIN_AGE = 6;
export const MAX_AGE = 99;

export function ageBand(age: number): AgeBand {
  if (age < 13) return 'under_13';
  if (age < 18) return '13_17';
  return '18_plus';
}

export const isMinor = (a: Answers) => a.age !== null && a.age < 18;

export function canContinue(step: StepId, a: Answers, now: Date = new Date()): boolean {
  switch (step) {
    case 'role': return a.role !== null;
    case 'voice': return a.voice !== null;
    case 'age':
      return a.age !== null && Number.isInteger(a.age) && a.age >= MIN_AGE && a.age <= MAX_AGE && (a.age >= 18 || a.guardianAck);
    case 'need': return a.need !== null;
    case 'prepMode': return a.prepMode === 'create';
    case 'examDate': {
      const d = a.examDate ? parseISODate(a.examDate) : null;
      return d !== null && d.getTime() > startOfDay(now).getTime();
    }
    case 'subject': return !!a.subject;
    case 'goal': return a.goal !== null;
    case 'concern': return a.concern !== null;
    case 'materials': return a.materials !== null;
  }
}

/** First step that is not yet valid; used to resume a draft safely. */
export function firstIncompleteStep(a: Answers, now: Date = new Date()): number {
  const i = STEPS.findIndex((s) => !canContinue(s, a, now));
  return i === -1 ? STEPS.length - 1 : i;
}

export const GOAL_TARGET: Record<Goal, number> = { pass: 60, good: 80, excellent: 95 };

/** Shape accepted by public.save_onboarding(); exact age never leaves the device. */
export function toServerPayload(a: Answers) {
  if (STEPS.some((s) => !canContinue(s, a))) throw new Error('ONBOARDING_INCOMPLETE');
  return {
    role: a.role, voice: a.voice, ageBand: ageBand(a.age!), need: a.need, prepMode: a.prepMode,
    examDate: a.examDate, subject: a.subject, goal: a.goal, concern: a.concern, materials: a.materials,
  };
}

/** Account type used at signup: minors never become account holders. */
export function accountTypeFor(a: Answers): 'guardian' | 'adult_student' | 'teacher' | 'other' {
  if (isMinor(a)) return 'guardian';
  if (a.role === 'student') return 'adult_student';
  if (a.role === 'teacher') return 'teacher';
  if (a.role === 'other') return 'other';
  return 'guardian';
}
