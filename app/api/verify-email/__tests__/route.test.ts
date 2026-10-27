import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/verify-email/route';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

// Fake Supabase: the business, and which columns were asked for
const db = vi.hoisted(() => {
  const state = { business: null as unknown, selected: [] as string[] };
  const from = () => {
    const chain = {
      select: (columns: string) => {
        state.selected.push(columns);
        return chain;
      },
      eq: () => chain,
      single: async () => ({ data: state.business, error: null }),
    };
    return chain;
  };
  return { state, from };
});
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: db.from } }));
// The check itself has its own tests
vi.mock('@/app/_shared/lib/email/leadEmailCheck', () => ({ checkLeadEmail: vi.fn() }));

const SAVED = { address: 'office@smiledental.com', verdict: 'Deliverable', status: 'Success', checked_at: '2026-10-04T12:00:00Z' };
const post = async (body: unknown) => {
  const res = await POST(new NextRequest(`https://auditely.app${API_ROUTES.VERIFY_EMAIL}`, { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  db.state.business = { id: 'b1', name: 'Smile Dental', email: 'office@smiledental.com', email_check: SAVED };
  db.state.selected = [];
  vi.mocked(checkLeadEmail).mockReset().mockResolvedValue({ state: 'off' });
});

describe('POST /api/verify-email', () => {
  it("is given longer than Verifalia's 20 seconds", () => {
    expect(maxDuration).toBe(30);
  });

  it.each([[{}], [{ business_id: 7 }], [null], ['not an object']])('refuses %j', async (body) => {
    expect(await post(body)).toEqual({ status: 400, json: { error: 'business_id is required' } });
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });

  it('needs a business with an email address', async () => {
    db.state.business = null;
    expect(await post({ business_id: 'b1' })).toEqual({ status: 404, json: { error: 'Business not found' } });
    db.state.business = { id: 'b1', email: null };
    expect(await post({ business_id: 'b1' })).toEqual({ status: 400, json: { error: 'This business has no email address.' } });
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });

  it('checks the stored address, never one from the request', async () => {
    await post({ business_id: 'b1', email: 'someone@else.com', email_check: { verdict: 'Deliverable' } });
    expect(checkLeadEmail).toHaveBeenCalledWith(expect.anything(), { id: 'b1', email: 'office@smiledental.com', email_check: SAVED });
  });

  // Naming the new column would fail before the migration is run
  it('reads the business without naming the new column', async () => {
    await post({ business_id: 'b1' });
    expect(db.state.selected).toEqual(['*']);
  });

  it.each([
    [{ state: 'off' } as const],
    [{ state: 'checked', check: SAVED, warning: "Checked, but the result couldn't be saved." } as const],
    [{ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' } as const],
  ])('answers %j', async (result) => {
    vi.mocked(checkLeadEmail).mockResolvedValue(result as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect(await post({ business_id: 'b1' })).toEqual({ status: 200, json: result });
  });
});
