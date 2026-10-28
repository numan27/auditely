// The owner's weekly numbers: free audits, and how far the accounts made in the
// last 7 and 30 days got (a search, an audit, a paid plan, an email sent).

import { describe, expect, it } from 'vitest';
import { growthCounts, type GrowthRows } from '@/app/_shared/lib/growth/funnel';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const ROWS: GrowthRows = {
  accounts: [
    { id: 'a1', createdAt: daysAgo(2) },
    { id: 'a2', createdAt: daysAgo(10) },
    { id: 'a3', createdAt: daysAgo(40) },
  ],
  searched: ['a1', 'a1', 'a2', 'a3'],
  audited: ['a1'],
  paying: ['a2', 'a3'],
  emailed: ['a2', 'a2'],
  freeAudits: [
    { createdAt: daysAgo(3), kept: true },
    { createdAt: daysAgo(20), kept: false },
    { createdAt: daysAgo(35), kept: true },
  ],
};

describe('growthCounts', () => {
  it('counts the last 7 days', () => {
    expect(growthCounts(ROWS, NOW)[0]).toEqual({
      days: 7, freeAudits: 1, kept: 1, accounts: 1, searched: 1, audited: 1, paying: 0, emailed: 0,
    });
  });

  it('counts the last 30 days', () => {
    expect(growthCounts(ROWS, NOW)[1]).toEqual({
      days: 30, freeAudits: 2, kept: 1, accounts: 2, searched: 2, audited: 1, paying: 1, emailed: 1,
    });
  });

  it("counts only the window's own accounts at each step, each once", () => {
    // a3 searched and pays, but was made 40 days ago
    const [, month] = growthCounts({ ...ROWS, searched: ['a3', 'a3'], paying: ['a3'] }, NOW);
    expect(month).toMatchObject({ accounts: 2, searched: 0, paying: 0 });
  });

  it('counts an account made exactly 7 days ago in the week', () => {
    const [week] = growthCounts({ ...ROWS, accounts: [{ id: 'edge', createdAt: daysAgo(7) }] }, NOW);
    expect(week.accounts).toBe(1);
  });
});
