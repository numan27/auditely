import { describe, it, expect } from 'vitest';
import { parseEmails, isOwnerEmail, canSignIn } from '@/app/_shared/lib/auth/account';

const env = (over: Record<string, string> = {}) =>
  ({ OWNER_EMAIL: 'Owner@Example.com', ALLOWED_EMAILS: ' tester@x.com, ,Other@Y.com ', ...over }) as unknown as NodeJS.ProcessEnv;

describe('sign-in rules', () => {
  it('parses a comma list, trimmed and lowercased', () =>
    expect(parseEmails(' A@x.com, ,b@Y.com ')).toEqual(['a@x.com', 'b@y.com']));

  it('parses nothing when the list is unset', () => expect(parseEmails(undefined)).toEqual([]));

  it('knows the owner whatever the case', () => {
    expect(isOwnerEmail('owner@example.com', env())).toBe(true);
    expect(isOwnerEmail(' OWNER@EXAMPLE.COM ', env())).toBe(true);
    expect(isOwnerEmail('tester@x.com', env())).toBe(false);
    expect(isOwnerEmail('owner@example.com', env({ OWNER_EMAIL: '' }))).toBe(false);
  });

  it('lets only the owner and the allowlist in while sign-ups are closed', () => {
    expect(canSignIn('owner@example.com', env())).toBe(true);
    expect(canSignIn('other@y.com', env())).toBe(true);
    expect(canSignIn('stranger@z.com', env())).toBe(false);
    expect(canSignIn('stranger@z.com', env({ SIGNUPS_OPEN: 'yes' }))).toBe(false);
    expect(canSignIn('stranger@z.com', env({ SIGNUPS_OPEN: 'true' }))).toBe(true);
  });
});
