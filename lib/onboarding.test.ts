import { accountTypeFor, ageBand, canContinue, EMPTY_ANSWERS, firstIncompleteStep, STEPS, toServerPayload, type Answers } from './onboarding';

const NOW = new Date(2026, 9, 28, 10);
const complete: Answers = {
  role: 'student', voice: 'luna', age: 15, guardianAck: true, need: 'upcoming_exam', prepMode: 'create',
  examDate: '2026-11-02', subject: 'matematicas', goal: 'good', concern: 'no_time', materials: 'have_notes',
};

describe('onboarding state machine', () => {
  it('has the ten required steps in order', () => {
    expect(STEPS).toEqual(['role', 'voice', 'age', 'need', 'prepMode', 'examDate', 'subject', 'goal', 'concern', 'materials']);
  });

  it('requires a choice on every step', () => {
    for (const step of STEPS) expect(canContinue(step, EMPTY_ANSWERS, NOW)).toBe(false);
    for (const step of STEPS) expect(canContinue(step, complete, NOW)).toBe(true);
  });

  it('blocks minors until an adult is involved', () => {
    expect(canContinue('age', { ...complete, age: 12, guardianAck: false }, NOW)).toBe(false);
    expect(canContinue('age', { ...complete, age: 12, guardianAck: true }, NOW)).toBe(true);
    expect(canContinue('age', { ...complete, age: 18, guardianAck: false }, NOW)).toBe(true);
    expect(canContinue('age', { ...complete, age: 3 }, NOW)).toBe(false);
    expect(canContinue('age', { ...complete, age: 12.5 }, NOW)).toBe(false);
  });

  it('only allows the implemented preparation mode', () => {
    expect(canContinue('prepMode', { ...complete, prepMode: 'join' }, NOW)).toBe(false);
  });

  it('rejects past or invalid exam dates', () => {
    expect(canContinue('examDate', { ...complete, examDate: '2026-10-28' }, NOW)).toBe(false);
    expect(canContinue('examDate', { ...complete, examDate: '2026-10-27' }, NOW)).toBe(false);
    expect(canContinue('examDate', { ...complete, examDate: 'mañana' }, NOW)).toBe(false);
  });

  it('resumes drafts at the first incomplete step', () => {
    expect(firstIncompleteStep(EMPTY_ANSWERS, NOW)).toBe(0);
    expect(firstIncompleteStep({ ...complete, subject: null }, NOW)).toBe(6);
  });

  it('never sends the exact age to the server', () => {
    const payload = toServerPayload({ ...complete, examDate: '2099-01-01' });
    expect(payload).not.toHaveProperty('age');
    expect(payload.ageBand).toBe('13_17');
    expect(() => toServerPayload(EMPTY_ANSWERS)).toThrow('ONBOARDING_INCOMPLETE');
  });

  it('maps age bands and account types (minors never own accounts)', () => {
    expect([ageBand(8), ageBand(13), ageBand(17), ageBand(18)]).toEqual(['under_13', '13_17', '13_17', '18_plus']);
    expect(accountTypeFor(complete)).toBe('guardian');
    expect(accountTypeFor({ ...complete, age: 20 })).toBe('adult_student');
    expect(accountTypeFor({ ...complete, age: 40, role: 'teacher' })).toBe('teacher');
  });
});
