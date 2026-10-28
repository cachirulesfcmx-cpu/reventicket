// Client-side upload validation. The server re-validates type and size (register_material
// + storage metadata check), so this only gives fast feedback.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'text/plain': 'TXT',
};

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', txt: 'text/plain',
};

/** Pickers sometimes omit or generalize the MIME type; fall back to the extension. */
export function resolveMimeType(name: string, reported?: string | null): string | null {
  const r = (reported ?? '').toLowerCase().split(';')[0].trim();
  if (r === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_TYPES[r]) return r;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

export type UploadCheck = { ok: true; mimeType: string } | { ok: false; error: 'unsupported_type' | 'too_large' | 'empty' };

export function validateUpload(file: { name: string; size?: number | null; mimeType?: string | null }): UploadCheck {
  const mimeType = resolveMimeType(file.name, file.mimeType);
  if (!mimeType) return { ok: false, error: 'unsupported_type' };
  if (!file.size || file.size <= 0) return { ok: false, error: 'empty' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_large' };
  return { ok: true, mimeType };
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return (base || 'Material').slice(0, 120);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
