// The sign-up form checks the password by the same rules as the server, so a
// password the route would refuse is caught before it's sent.

import { describe, it, expect } from 'vitest';
import { signupSchema } from '@/app/_shared/lib/validations/schemas';

const problem = (values: Record<string, string>) =>
  signupSchema.validate(values).then(() => null, (error: Error) => error.message);

describe('signupSchema', () => {
  it('takes an email and a password of 8 to 72 bytes', async () => {
    expect(await problem({ email: 'new@example.com', password: 'eight888' })).toBeNull();
  });

  it('asks for a password, one long enough, and one short enough', async () => {
    expect(await problem({ email: 'new@example.com', password: '' })).toBe('Choose a password');
    expect(await problem({ email: 'new@example.com', password: 'seven77' })).toBe('Use at least 8 characters.');
    expect(await problem({ email: 'new@example.com', password: 'é'.repeat(37) })).toBe('Use 72 characters or fewer.');
  });

  it('asks for the email first', async () => {
    expect(await problem({ email: 'nope', password: 'eight888' })).toBe('Enter your email address');
  });
});
