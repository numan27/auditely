// The free audit's steps on the landing page: what a visitor sees after each
// answer, when they're offered an account, and what to do when the request
// never reached Auditely.

import { describe, it, expect } from 'vitest';
import { freeAuditStep, signUpOffered, type FreeAuditState } from '@/app/_shared/components/landing/freeAuditFlow';
import { FREE_AUDIT_COPY, type FreeAuditReason, type FreeAuditView } from '@/app/_shared/lib/freeAudit/freeAuditCopy';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';

const result: FreeAuditView = {
  website: 'https://example.com/',
  host: 'example.com',
  createdAt: '2026-10-28T10:00:00.000Z',
  audit: {} as AuditFields,
  report: null,
};
const running = freeAuditStep({ kind: 'idle' }, { type: 'submit', host: 'example.com' });
const answered = (again: boolean) => freeAuditStep(running, { type: 'answer', response: { ok: true, result, again } });
const refused = (reason: FreeAuditReason, error: string) =>
  freeAuditStep(running, { type: 'answer', response: { ok: false, reason, error } });

describe('freeAuditStep', () => {
  it('shows the result, or the previous one again, from the answer', () => {
    expect(running).toEqual({ kind: 'running', host: 'example.com' });
    expect(answered(false)).toEqual({ kind: 'done', result, again: false });
    expect(answered(true)).toEqual({ kind: 'done', result, again: true });
    expect(refused('cap', FREE_AUDIT_COPY.cap)).toEqual({ kind: 'refused', reason: 'cap', message: FREE_AUDIT_COPY.cap });
  });

  it('runs no second audit while a result shows, and says the free one is used', () => {
    const done = answered(false);
    const again = freeAuditStep(done, { type: 'submit', host: 'other.com' });
    expect(again).toEqual({ kind: 'done', result, again: false, resubmitted: true });
    expect(signUpOffered(again)).toBe(true);
  });

  it('offers sign-up for a used audit and a full day, not for a bad address', () => {
    expect(signUpOffered(answered(true))).toBe(true);
    expect(signUpOffered(refused('visitor', FREE_AUDIT_COPY.visitor))).toBe(true);
    expect(signUpOffered(refused('cap', FREE_AUDIT_COPY.cap))).toBe(true);

    expect(signUpOffered(answered(false))).toBe(false);
    expect(signUpOffered(refused('invalid', 'Enter a website address, like example.com.'))).toBe(false);
    expect(signUpOffered(refused('notPublic', FREE_AUDIT_COPY.notPublic))).toBe(false);
    expect(signUpOffered(refused('failed', FREE_AUDIT_COPY.failed('example.com', 'the site didn’t respond')))).toBe(false);
    expect(signUpOffered(refused('bot', FREE_AUDIT_COPY.bot))).toBe(false);
    expect(signUpOffered({ kind: 'idle' })).toBe(false);
    expect(signUpOffered(running)).toBe(false);
  });

  it('offers sign-up when free audits are off or not set up, since the message asks for it', () => {
    expect(signUpOffered(refused('off', FREE_AUDIT_COPY.off))).toBe(true);
    expect(signUpOffered(refused('unavailable', FREE_AUDIT_COPY.unavailable))).toBe(true);
  });

  it('says what to do when Auditely cannot be reached', () => {
    const state: FreeAuditState = freeAuditStep(running, { type: 'networkError' });
    expect(state).toEqual({
      kind: 'refused',
      reason: 'failed',
      message: "Couldn't reach Auditely. Check your connection and try again.",
    });
    expect(signUpOffered(state)).toBe(false);
  });

  it('lets a visitor try again after a refusal', () => {
    const after = freeAuditStep(refused('invalid', 'Enter a website address, like example.com.'), { type: 'submit', host: 'example.org' });
    expect(after).toEqual({ kind: 'running', host: 'example.org' });
  });
});
