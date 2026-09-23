import { describe, it, expect } from 'vitest';
import { CURRENT_ENGINE_VERSION, isOutdatedAudit } from '@/app/_shared/lib/audit/types';

describe('isOutdatedAudit', () => {
  it('treats missing or older engine versions as outdated', () => {
    expect(CURRENT_ENGINE_VERSION).toBe(2);
    expect(isOutdatedAudit(undefined)).toBe(true);
    expect(isOutdatedAudit(null)).toBe(true);
    expect(isOutdatedAudit(1)).toBe(true);
    expect(isOutdatedAudit(2)).toBe(false);
  });
});
