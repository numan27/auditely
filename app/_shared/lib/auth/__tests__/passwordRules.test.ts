// The password rules sign-up and Settings share: long enough to be worth having,
// and no longer than Supabase's bcrypt reads (72 bytes, so fewer for accented letters).
// And the code a new account confirms its email with.

import { describe, it, expect } from 'vitest';
import { passwordProblem, readCode, CODE_LENGTH } from '@/app/_shared/lib/auth/passwordRules';

describe('passwordProblem', () => {
  it('asks for at least 8 characters', () => {
    for (const password of ['', 'short', '1234567']) expect(passwordProblem(password)).toBe('Use at least 8 characters.');
    expect(passwordProblem('12345678')).toBeNull();
  });

  it('refuses more than bcrypt reads, counting bytes', () => {
    expect(passwordProblem('a'.repeat(72))).toBeNull();
    expect(passwordProblem('a'.repeat(73))).toBe('Use 72 characters or fewer.');
    expect(passwordProblem('é'.repeat(36))).toBeNull();
    expect(passwordProblem('é'.repeat(37))).toBe('Use 72 characters or fewer.');
  });
});

describe('readCode', () => {
  it('is 6 digits', () => {
    expect(CODE_LENGTH).toBe(6);
  });

  it('reads the code as typed or pasted, spaces and all', () => {
    expect(readCode('482917')).toBe('482917');
    expect(readCode(' 482 917 ')).toBe('482917');
  });

  it("refuses anything that isn't a 6-digit code", () => {
    for (const value of ['48291', '4829170', 'abcdef', '48291a', '', null, undefined, 482917]) expect(readCode(value)).toBeNull();
  });
});
