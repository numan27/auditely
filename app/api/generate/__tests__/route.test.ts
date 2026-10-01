import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/generate/route';
import { impactFor } from '@/app/_shared/lib/audit/impact';

// Fake Supabase: no cached report, then the audit (with its business), then the insert
const db = vi.hoisted(() => {
  const state = { audit: null as unknown, inserted: null as Record<string, unknown> | null };
  const from = (table: string) => {
    let op = 'select';
    const chain = {
      select: () => chain,
      insert: (value: Record<string, unknown>) => {
        op = 'insert';
        state.inserted = value;
        return chain;
      },
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () =>
        table === 'audits'
          ? { data: state.audit, error: null }
          : op === 'insert'
            ? { data: { id: 'report-1', ...state.inserted }, error: null }
            : { data: null, error: null },
    };
    return chain;
  };
  return { state, from };
});
const groq = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: groq.create } };
  },
}));

const answer = (summary: string, cold_email: string) => ({ choices: [{ message: { content: JSON.stringify({ summary, cold_email }) } }] });

async function post() {
  const res = await POST(new NextRequest('http://localhost/api/generate', { method: 'POST', body: JSON.stringify({ audit_id: 'audit-1' }) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
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
    businesses: { name: 'Smile Dental', website: 'https://smiledental.com' },
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
});
