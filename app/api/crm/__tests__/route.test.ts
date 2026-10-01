import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/crm/route';
import { HubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';

// Fake Supabase: the business (with its audit, report and search) and every update
const db = vi.hoisted(() => {
  // updateErrors: one entry per update, in order (null = it worked)
  const state = { business: null as unknown, updates: [] as Record<string, unknown>[], updateErrors: [] as (string | null)[] };
  const from = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: state.business, error: null }),
      update: (value: Record<string, unknown>) => {
        state.updates.push(value);
        const message = state.updateErrors.shift() ?? null;
        return { eq: async () => ({ error: message ? { message } : null }) };
      },
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/crm/hubspot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/crm/hubspot')>()),
  sendLead: vi.fn(),
}));

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const businessRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: null, email: null,
  rating: null, review_count: null, hubspot_company_id: 'c-old', searches: { niche: 'dentists' },
  audits: {
    id: AUDIT, business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, performance_score: 50, seo_score: 80,
    mobile_score: 40, ssl_valid: true, geo_score: null, aeo_score: null, lead_score: null, raw_json: {}, checks: {},
    ai_reports: { id: 'r1', audit_id: AUDIT, summary: 'S', improvements: [], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' },
  },
  ...over,
});

const post = (body: unknown) =>
  POST(new NextRequest('https://auditely.app/api/crm', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('HUBSPOT_TOKEN', 'token-1');
  vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.business = businessRow();
  db.state.updates = [];
  db.state.updateErrors = [];
  // args[2] is sendLead's options: the route's onCompanySaved
  vi.mocked(sendLead).mockReset().mockImplementation(async (...args) => {
    await args[2].onCompanySaved('c-old');
    return { companyId: 'c-old', contactId: null };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/crm', () => {
  it('sends the lead with a private report link and records the send', async () => {
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(200);
    const [token, lead, options] = vi.mocked(sendLead).mock.calls[0];
    expect(token).toBe('token-1');
    expect(lead.noteHtml).toMatch(new RegExp(`href="https://auditely\\.app/report/${AUDIT}\\.[A-Za-z0-9_-]+"`));
    expect(lead.company.industry).toBe('MEDICAL_PRACTICE');
    expect(options.savedCompanyId).toBe('c-old');
    expect(db.state.updates[0]).toEqual({ hubspot_company_id: 'c-old' });
    expect(db.state.updates[1]).toHaveProperty('crm_sent_at');
    expect((await res.json()).crm_sent_at).toBe(db.state.updates[1].crm_sent_at);
  });

  it('keeps the company id but records no send when a later step fails', async () => {
    vi.mocked(sendLead).mockImplementation(async (...args) => {
      await args[2].onCompanySaved('c-new');
      throw new HubSpotError('Internal error', 500, 'other');
    });
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("HubSpot couldn't save the lead: Internal error");
    expect(db.state.updates).toEqual([{ hubspot_company_id: 'c-new' }]);
  });

  it("stops and says what to do when the HubSpot company id can't be saved", async () => {
    db.state.updateErrors = ['column "hubspot_company_id" does not exist'];
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      "HubSpot has the company, but Auditely couldn't save the link to it — run docs/migrations/2026-10-01-hubspot.sql in Supabase, then send again."
    );
  });

  it("says so when the lead was sent but the send couldn't be recorded", async () => {
    db.state.updateErrors = [null, 'column "crm_sent_at" does not exist'];
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      "Sent to HubSpot, but Auditely couldn't record it — run docs/migrations/2026-10-01-hubspot.sql in Supabase."
    );
  });

  it('asks for the audit and summary first', async () => {
    db.state.business = businessRow({ audits: null });
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Run the audit and AI summary first.');
    expect(sendLead).not.toHaveBeenCalled();
  });

  it('explains when HubSpot is not connected', async () => {
    vi.stubEnv('HUBSPOT_TOKEN', '');
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("HubSpot isn't connected — add HUBSPOT_TOKEN in Vercel.");
  });
});
