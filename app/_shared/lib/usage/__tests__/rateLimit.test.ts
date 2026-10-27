import { describe, it, expect } from 'vitest';
import { windowLimit } from '@/app/_shared/lib/usage/rateLimit';

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
