import { describe, it, expect } from 'vitest';
import { connectAllowed, feedbackAllowed, sendAllowed, windowLimit } from '@/app/_shared/lib/usage/rateLimit';

describe('windowLimit', () => {
  it('allows the limit within a window and refuses the next', () => {
    const allow = windowLimit({ limit: 2, windowMs: 1000 });
    expect([allow('a', 0), allow('a', 10), allow('a', 20)]).toEqual([true, true, false]);
  });

  it('starts counting again once the window has passed', () => {
    const allow = windowLimit({ limit: 1, windowMs: 1000 });
    allow('a', 0);
    expect(allow('a', 999)).toBe(false);
    expect(allow('a', 1000)).toBe(true);
  });

  it('counts each key on its own', () => {
    const allow = windowLimit({ limit: 1, windowMs: 1000 });
    expect([allow('a', 0), allow('b', 0), allow('a', 1)]).toEqual([true, true, false]);
  });

  it('holds at most maxKeys, forgetting the oldest first', () => {
    const allow = windowLimit({ limit: 1, windowMs: 1000, maxKeys: 2 });
    allow('a', 0);
    allow('b', 0);
    allow('c', 0);
    expect(allow('c', 1)).toBe(false);
    expect(allow('a', 1)).toBe(true);
  });
});

describe('mailbox and HubSpot limits', () => {
  it('lets an account try a connection 10 times an hour', () => {
    const tries = Array.from({ length: 11 }, (_, i) => connectAllowed('connect-a', i));
    expect(tries.filter(Boolean)).toHaveLength(10);
    expect(tries[10]).toBe(false);
    expect(connectAllowed('connect-a', 60 * 60_000)).toBe(true);
  });

  it('lets an account send 50 emails an hour', () => {
    const sends = Array.from({ length: 51 }, (_, i) => sendAllowed('send-a', i));
    expect(sends.filter(Boolean)).toHaveLength(50);
    expect(sends[50]).toBe(false);
    expect(sendAllowed('send-b', 0)).toBe(true);
  });
});

describe('feedback limit', () => {
  it('lets an account send 10 messages an hour', () => {
    const sent = Array.from({ length: 11 }, (_, i) => feedbackAllowed('feedback-a', i));
    expect(sent.filter(Boolean)).toHaveLength(10);
    expect(sent[10]).toBe(false);
    expect(feedbackAllowed('feedback-b', 0)).toBe(true);
    expect(feedbackAllowed('feedback-a', 60 * 60_000)).toBe(true);
  });
});
