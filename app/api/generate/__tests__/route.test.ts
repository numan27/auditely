import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/generate/route';
import { impactFor } from '@/app/_shared/lib/audit/impact';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import { BRAND_UNAVAILABLE, BrandUnavailable } from '@/app/_shared/lib/brand/brand';

// Fake Supabase: the saved report (if any), then the audit (with its business),
// then the insert, or the update when a saved report is written again
const db = vi.hoisted(() => {
  const state = {
    audit: null as unknown,
    savedReport: null as Record<string, unknown> | null,
    inserted: null as Record<string, unknown> | null,
    updated: null as { id: unknown; values: Record<string, unknown> } | null,
  };
  const from = (table: string) => {
    let op = 'select';
    let values: Record<string, unknown> = {};
    const chain = {
      select: () => chain,
      insert: (value: Record<string, unknown>) => {
        op = 'insert';
        state.inserted = value;
        return chain;
      },
      update: (value: Record<string, unknown>) => {
        op = 'update';
        values = value;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        if (op === 'update' && column === 'id') state.updated = { id: value, values };
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: table === 'ai_reports' ? state.savedReport : null, error: null }),
      single: async () =>
        table === 'audits'
          ? { data: state.audit, error: null }
          : op === 'insert'
            ? { data: { id: 'report-1', ...state.inserted }, error: null }
            : op === 'update'
              ? { data: { ...state.savedReport, ...values }, error: null }
              : { data: null, error: null },
    };
    return chain;
  };
  return { state, from };
});
const groq = vi.hoisted(() => ({ create: vi.fn() }));

const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
// The business's account writes as Sam at Acme
const brandFor = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/brand/brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/brand/brand')>()),
  brandFor,
}));
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: groq.create } };
  },
}));

const answer = (summary: string, cold_email: string) => ({ choices: [{ message: { content: JSON.stringify({ summary, cold_email }) } }] });

const request = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(body) });

async function post(body: Record<string, unknown> = { audit_id: 'audit-1' }) {
  const res = await POST(request(body));
  return { status: res.status, json: await res.json() };
}

const ownerSession = () => ({ db: { from: db.from }, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } });
const accountSession = (id: string) => ({ db: { from: db.from }, account: { id, email: `${id}@x.com`, isOwner: false } });
const acme = resolveBrand({
  profile: { email: 'sam@x.com', display_name: 'Sam', company: 'Acme', website: null, logo_data_url: null, contact_email: null, contact_phone: null, booking_url: null },
  isOwner: false,
  plan: 'pro',
});

beforeEach(() => {
  session.current = ownerSession();
  brandFor.mockReset().mockResolvedValue(acme);
  db.state.savedReport = null;
  db.state.updated = null;
  vi.stubEnv('GROQ_API_KEY', 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.inserted = null;
  db.state.audit = {
    id: 'audit-1',
    created_at: '2026-10-01T00:00:00Z',
    performance_score: 80,
    seo_score: 90,
    mobile_score: 70,
    ssl_valid: true,
    raw_json: { mobile: null, desktop: null },
    checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'No form' }], pages: [], links: { checked: 0, broken: [] } } },
    engine_version: 2,
    businesses: { name: 'Smile Dental', website: 'https://smiledental.com', user_id: 'u2' },
  };
  groq.create.mockReset().mockResolvedValue(answer('No easy way to message you.', 'Subject: Quick note\n\nVisitors cannot message you.'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/generate', () => {
  it("stores the library's fixes with the model's summary and email", async () => {
    const { status, json } = await post();
    expect(status).toBe(200);
    expect(db.state.inserted).toEqual({
      audit_id: 'audit-1',
      summary: 'No easy way to message you.',
      improvements: [impactFor('lead.form', 'fail')?.fix],
      cold_email: 'Subject: Quick note\n\nVisitors cannot message you.',
    });
    expect(json.ai_report.id).toBe('report-1');
    expect(groq.create.mock.calls[0][0].messages[0].content).toContain(`1. ${impactFor('lead.form', 'fail')?.problem}.`);
  });

  it('returns 500 and stores nothing when the model does not answer in JSON', async () => {
    groq.create.mockResolvedValue({ choices: [{ message: { content: 'Sure! Here you go' } }] });
    const { status, json } = await post();
    expect(status).toBe(500);
    expect(json.error).toBe('AI returned invalid JSON');
    expect(db.state.inserted).toBeNull();
  });

  it('returns 503 when the AI service fails', async () => {
    groq.create.mockRejectedValue(new Error('rate limited'));
    const { status, json } = await post();
    expect(status).toBe(503);
    expect(json.error).toBe('AI service unavailable');
  });

  it('writes as the brand of the business’s account', async () => {
    await post();
    expect(brandFor).toHaveBeenCalledWith('u2');
    expect(groq.create.mock.calls[0][0].messages[0].content).toContain('Sign off with: Sam, Acme');
    expect(groq.create.mock.calls[0][0].messages[0].content.toLowerCase()).not.toContain('devart');
  });

  it('serves a saved report as it is, without asking the model', async () => {
    db.state.savedReport = { id: 'r1', audit_id: 'audit-1', summary: 'old', created_at: '2026-10-02T00:00:00Z' };
    const { status, json } = await post();
    expect([status, json.ai_report.summary]).toEqual([200, 'old']);
    expect(groq.create).not.toHaveBeenCalled();
  });

  it('writes a saved report again, in place, when asked', async () => {
    db.state.savedReport = { id: 'r1', audit_id: 'audit-1', summary: 'old', created_at: '2026-10-02T00:00:00Z' };
    const { status, json } = await post({ audit_id: 'audit-1', rewrite: true });
    expect(status).toBe(200);
    expect(db.state.updated).toEqual({
      id: 'r1',
      values: { summary: 'No easy way to message you.', improvements: [impactFor('lead.form', 'fail')?.fix], cold_email: expect.any(String) },
    });
    expect(db.state.inserted).toBeNull();
    // The row keeps its id and when it was first written
    expect([json.ai_report.id, json.ai_report.created_at, json.ai_report.summary]).toEqual(['r1', '2026-10-02T00:00:00Z', 'No easy way to message you.']);
  });

  it('writes a first report as usual when asked to write again before there is one', async () => {
    const { status } = await post({ audit_id: 'audit-1', rewrite: true });
    expect(status).toBe(200);
    expect(db.state.inserted).not.toBeNull();
    expect(db.state.updated).toBeNull();
  });

  it('stops an account after 10 rewrites in an hour, but never the owner', async () => {
    db.state.savedReport = { id: 'r1', audit_id: 'audit-1', summary: 'old' };
    session.current = accountSession('u-rewrites');
    for (let i = 0; i < 10; i++) expect((await post({ audit_id: 'audit-1', rewrite: true })).status).toBe(200);
    const refused = await post({ audit_id: 'audit-1', rewrite: true });
    expect([refused.status, refused.json.error]).toEqual([429, 'You can write a summary again 10 times an hour. Try again later.']);
    // Refused before any work
    expect(groq.create.mock.calls.length).toBeLessThanOrEqual(20);
    const calls = groq.create.mock.calls.length;
    await post({ audit_id: 'audit-1', rewrite: true });
    expect(groq.create.mock.calls.length).toBe(calls);

    session.current = ownerSession();
    expect((await post({ audit_id: 'audit-1', rewrite: true })).status).toBe(200);
  });

  it('answers 503 when the branding can’t be read, and writes nothing', async () => {
    brandFor.mockRejectedValueOnce(new BrandUnavailable());
    const { status, json } = await post();
    expect([status, json.error]).toEqual([503, BRAND_UNAVAILABLE]);
    expect(groq.create).not.toHaveBeenCalled();
    expect(db.state.inserted).toBeNull();
  });
});
