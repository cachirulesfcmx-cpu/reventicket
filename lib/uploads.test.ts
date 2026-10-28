import { formatBytes, MAX_UPLOAD_BYTES, resolveMimeType, titleFromFileName, validateUpload } from './uploads';

describe('upload validation', () => {
  it('accepts the allowed types', () => {
    expect(validateUpload({ name: 'a.pdf', size: 10, mimeType: 'application/pdf' })).toEqual({ ok: true, mimeType: 'application/pdf' });
    expect(validateUpload({ name: 'a.JPG', size: 10, mimeType: '' })).toEqual({ ok: true, mimeType: 'image/jpeg' });
    expect(resolveMimeType('x', 'image/jpg')).toBe('image/jpeg');
    expect(resolveMimeType('notes.txt', 'text/plain; charset=utf-8')).toBe('text/plain');
  });

  it('rejects dangerous or unknown types even when renamed', () => {
    expect(validateUpload({ name: 'virus.exe', size: 10, mimeType: 'application/x-msdownload' })).toEqual({ ok: false, error: 'unsupported_type' });
    expect(validateUpload({ name: 'page.html', size: 10, mimeType: 'text/html' })).toEqual({ ok: false, error: 'unsupported_type' });
    expect(validateUpload({ name: 'img.svg', size: 10, mimeType: 'image/svg+xml' })).toEqual({ ok: false, error: 'unsupported_type' });
  });

  it('enforces size limits', () => {
    expect(validateUpload({ name: 'a.pdf', size: MAX_UPLOAD_BYTES + 1, mimeType: 'application/pdf' })).toEqual({ ok: false, error: 'too_large' });
    expect(validateUpload({ name: 'a.pdf', size: 0, mimeType: 'application/pdf' })).toEqual({ ok: false, error: 'empty' });
  });

  it('derives display titles and sizes', () => {
    expect(titleFromFileName('guia_examen-final.pdf')).toBe('guia examen final');
    expect(titleFromFileName('.pdf')).toBe('Material');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
