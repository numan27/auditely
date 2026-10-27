import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UsageSummary } from '@/app/_shared/lib/usage/plans';

const usageSummary = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/usage/usage', () => ({ usageSummary }));
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { GET } = await import('@/app/api/usage/route');

const SUMMARY: UsageSummary = {
  plan: 'free', resetsAt: '2026-11-01T00:00:00.000Z',
  usage: { search: { used: 1, limit: 1 }, audit: { used: 2, limit: 5 }, email_lookup: { used: 0, limit: 0 } },
};

beforeEach(() => {
  usageSummary.mockReset();
  session.current = { db: { tag: 'user-db' }, account: { id: 'u2', email: 'tester@x.com', isOwner: false } };
});

describe('GET /api/usage', () => {
  it("answers this month's usage for the signed-in account", async () => {
    usageSummary.mockResolvedValue(SUMMARY);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SUMMARY);
    expect(usageSummary).toHaveBeenCalledWith({ tag: 'user-db' }, { id: 'u2', email: 'tester@x.com', isOwner: false });
  });

  it("says so when the usage can't be counted", async () => {
    usageSummary.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Couldn't load this month's usage." });
  });
});
