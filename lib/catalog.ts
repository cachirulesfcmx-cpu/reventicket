// Mirrors public.subjects (migration 0002). Names are generic school subjects, not SEP content.
export type Subject = { slug: string; name: string; glyph: string };

export const SUBJECTS: Subject[] = [
  { slug: 'matematicas', name: 'Matemáticas', glyph: '∑' },
  { slug: 'espanol', name: 'Español', glyph: 'Ñ' },
  { slug: 'fisica', name: 'Física', glyph: '⚛' },
  { slug: 'quimica', name: 'Química', glyph: '⚗' },
  { slug: 'biologia', name: 'Biología', glyph: '❦' },
  { slug: 'historia', name: 'Historia', glyph: '⌛' },
  { slug: 'geografia', name: 'Geografía', glyph: '◍' },
  { slug: 'ingles', name: 'Inglés', glyph: 'EN' },
  { slug: 'informatica', name: 'Informática', glyph: '⌘' },
  { slug: 'civismo', name: 'Formación cívica y ética', glyph: '⚖' },
  { slug: 'economia', name: 'Economía', glyph: '▥' },
  { slug: 'filosofia', name: 'Filosofía', glyph: '◉' },
  { slug: 'psicologia', name: 'Psicología', glyph: 'Ψ' },
  { slug: 'frances', name: 'Francés', glyph: 'FR' },
];

export const OTHER_SUBJECT: Subject = { slug: 'otra', name: 'Otra materia', glyph: '+' };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Accent- and case-insensitive subject search. */
export function searchSubjects(query: string, list: Subject[] = SUBJECTS): Subject[] {
  const q = fold(query);
  return q ? list.filter((s) => fold(s.name).includes(q)) : list;
}

export function subjectName(slug: string | null | undefined): string {
  return [...SUBJECTS, OTHER_SUBJECT].find((s) => s.slug === slug)?.name ?? 'Materia';
}

export const SCHOOL_LEVELS = [
  { value: 'primaria', label: 'Primaria' },
  { value: 'secundaria', label: 'Secundaria' },
  { value: 'preparatoria', label: 'Preparatoria' },
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number]['value'];
