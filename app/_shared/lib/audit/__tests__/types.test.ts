import { describe, it, expect } from 'vitest';
import { CURRENT_ENGINE_VERSION, isOutdatedAudit, isStaleAudit } from '@/app/_shared/lib/audit/types';

describe('isOutdatedAudit', () => {
  it('treats missing or older engine versions as outdated', () => {
    expect(CURRENT_ENGINE_VERSION).toBe(2);
    expect(isOutdatedAudit(undefined)).toBe(true);
    expect(isOutdatedAudit(null)).toBe(true);
    expect(isOutdatedAudit(1)).toBe(true);
    expect(isOutdatedAudit(2)).toBe(false);
  });
});

describe('isStaleAudit', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  const audit = (createdAt: string, psiMeasuredAt?: string) => ({
    created_at: createdAt,
    checks: { psi: { mobile: 'ok', desktop: 'ok', ...(psiMeasuredAt && { measuredAt: psiMeasuredAt }) } },
  });

  it('keeps an audit fresh for 30 days, then marks it stale', () => {
    expect(isStaleAudit(audit('2026-09-01T12:00:00Z'), now)).toBe(false); // 29 days
    expect(isStaleAudit(audit('2026-08-30T12:00:00Z'), now)).toBe(true); // 31 days
  });

  it('dates the audit by its PageSpeed results when they were reused from an earlier test', () => {
    // Audited 10 days ago with speed results measured 25 days before that
    expect(isStaleAudit(audit('2026-09-20T12:00:00Z', '2026-08-26T12:00:00Z'), now)).toBe(true);
    expect(isStaleAudit(audit('2026-09-20T12:00:00Z', '2026-09-15T12:00:00Z'), now)).toBe(false);
  });

  it('handles audits written before checks existed', () => {
    expect(isStaleAudit({ created_at: '2026-09-29T12:00:00Z', checks: {} }, now)).toBe(false);
    expect(isStaleAudit({ created_at: '2026-01-01T12:00:00Z', checks: null }, now)).toBe(true);
  });
});
