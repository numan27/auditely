import { describe, it, expect } from 'vitest';
import { COLD_SENDS_PER_DAY, coldSendProblem } from '@/app/_shared/lib/email/sendGuards';
import type { Db } from '@/app/_shared/lib/supabase/client';

type Row = { id: string; name: string | null; email: string; emailed_at: string | null };

// Fake client: rows matching .eq('email'), and a count of rows emailed since .gte('emailed_at')
function fakeDb(rows: Row[]) {
  const asked: { since?: string } = {};
  const db = {
    from: () => ({
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => ({
        eq: async (_col: string, value: string) => ({ data: rows.filter((r) => r.email === value), error: null }),
        gte: async (_col: string, since: string) => {
          asked.since = since;
          return { count: opts?.count ? rows.filter((r) => r.emailed_at && r.emailed_at >= since).length : null, error: null };
        },
      }),
    }),
  } as unknown as Db;
  return { db, asked };
}

const NOW = new Date('2026-11-20T15:00:00Z');
const lead = { businessId: 'b1', email: 'office@smile.com' };

describe('coldSendProblem', () => {
  it('lets a first email go', async () => {
    const { db, asked } = fakeDb([{ id: 'b1', name: 'Smile', email: 'office@smile.com', emailed_at: null }]);
    expect(await coldSendProblem(db, lead, NOW)).toBeNull();
    // The day starts at midnight UTC
    expect(asked.since).toBe('2026-11-20T00:00:00.000Z');
  });

  it("lets a lead's own follow-up go", async () => {
    const { db } = fakeDb([{ id: 'b1', name: 'Smile', email: 'office@smile.com', emailed_at: '2026-11-17T10:00:00Z' }]);
    expect(await coldSendProblem(db, lead, NOW)).toBeNull();
  });

  it('refuses an address already emailed for another lead, and says when and for whom', async () => {
    const { db } = fakeDb([
      { id: 'b1', name: 'Smile', email: 'office@smile.com', emailed_at: null },
      { id: 'b2', name: 'Smile Dental Clinic', email: 'office@smile.com', emailed_at: '2026-11-03T22:10:00Z' },
    ]);
    expect(await coldSendProblem(db, lead, NOW)).toBe('Not sent: office@smile.com was already emailed on Nov 3 for Smile Dental Clinic.');
  });

  it('ignores a duplicate listing that was never emailed', async () => {
    const { db } = fakeDb([{ id: 'b2', name: 'Smile 2', email: 'office@smile.com', emailed_at: null }]);
    expect(await coldSendProblem(db, lead, NOW)).toBeNull();
  });

  it('stops at the daily cap, counting only today', async () => {
    const today = Array.from({ length: COLD_SENDS_PER_DAY }, (_, i) => ({
      id: `t${i}`, name: null, email: `x${i}@a.com`, emailed_at: '2026-11-20T09:00:00Z',
    }));
    const { db } = fakeDb(today);
    expect(await coldSendProblem(db, lead, NOW)).toMatch(/^You've sent 25 cold emails today/);
    const yesterday = today.map((r) => ({ ...r, emailed_at: '2026-11-19T23:00:00Z' }));
    expect(await coldSendProblem(fakeDb(yesterday).db, lead, NOW)).toBeNull();
  });
});
