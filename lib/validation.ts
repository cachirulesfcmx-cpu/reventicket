import { parseISODate, startOfDay } from './dates';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Mirrors supabase/config.toml: min 10 chars with lower, upper and digit. */
export function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 10) issues.push('Al menos 10 caracteres');
  if (!/[a-z]/.test(pw)) issues.push('Una letra minúscula');
  if (!/[A-Z]/.test(pw)) issues.push('Una letra mayúscula');
  if (!/\d/.test(pw)) issues.push('Un número');
  return issues;
}

export function parseTopics(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 120))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 30);
}

export type PlanInput = { title: string; subject: string; topics: string; examDate: string; targetScore?: number | null };

export function validatePlan(p: PlanInput, now: Date = new Date()): string | null {
  if (!p.title.trim()) return 'Escribe un nombre para tu plan.';
  if (p.title.trim().length > 120) return 'El nombre es demasiado largo (máximo 120 caracteres).';
  if (!p.subject) return 'Elige una materia.';
  if (parseTopics(p.topics).length === 0) return 'Agrega al menos un tema.';
  if (p.examDate.trim()) {
    const d = parseISODate(p.examDate);
    if (!d) return 'La fecha debe tener el formato AAAA-MM-DD.';
    if (d.getTime() < startOfDay(now).getTime()) return 'La fecha del examen ya pasó.';
  }
  if (p.targetScore != null && (p.targetScore < 0 || p.targetScore > 100)) return 'La meta debe estar entre 0 y 100.';
  return null;
}
