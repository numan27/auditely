import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/send-email/route';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

// Fake Supabase: the business (with its audit and report) and every update
const db = vi.hoisted(() => {
  const state = { business: null as unknown, updates: [] as Record<string, unknown>[], updateError: null as string | null };
  const from = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: state.business, error: null }),
      update: (value: Record<string, unknown>) => {
        state.updates.push(value);
        return { eq: async () => ({ error: state.updateError ? { message: state.updateError } : null }) };
      },
    };
    return chain;
  };
  return { state, from };
});
// Fake Resend: records each email; `answer` is what its API replies
const mail = vi.hoisted(() => ({
  send: vi.fn(),
  keys: [] as string[],
}));

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mail.send };
    constructor(key: string) {
      mail.keys.push(key);
    }
  },
}));

const PDF = Buffer.from('%PDF-1.7');
const businessRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: null, email: 'office@smiledental.com',
  audits: {
    id: 'a1', business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, raw_json: {}, checks: {},
    ai_reports: { id: 'r1', audit_id: 'a1', summary: 'S', improvements: [], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' },
  },
  ...over,
});
const draft = { business_id: 'b1', subject: 'Quick note about your site', body: 'Hi there,\nYour site is slow.' };
const post = async (body: unknown) => {
  const res = await POST(new NextRequest('https://auditely.app/api/send-email', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_key');
  vi.stubEnv('FROM_EMAIL', 'Numan <numan@devartventures.com>');
  vi.stubEnv('EMAIL_REPLY_TO', '');
  vi.stubEnv('EMAIL_BCC', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.business = businessRow();
  db.state.updates = [];
  db.state.updateError = null;
  mail.keys.length = 0;
  mail.send.mockReset().mockResolvedValue({ data: { id: 'email-1' }, error: null });
  vi.mocked(renderAuditPdf).mockReset().mockResolvedValue({ ok: true, pdf: PDF, filename: 'audit-smile-dental.pdf' });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/send-email', () => {
  it("sends the edited email to the business with the PDF attached, and records when", async () => {
    const { status, json } = await post(draft);
    expect(status).toBe(200);
    expect(mail.keys).toEqual(['re_key']);
    expect(mail.send).toHaveBeenCalledWith({
      from: 'Numan <numan@devartventures.com>',
      to: 'office@smiledental.com',
      subject: 'Quick note about your site',
      text: 'Hi there,\nYour site is slow.',
      attachments: [{ filename: 'audit-smile-dental.pdf', content: PDF }],
    });
    expect(renderAuditPdf).toHaveBeenCalledWith('a1');
    expect(db.state.updates).toEqual([{ emailed_at: json.emailed_at }]);
    expect(new Date(json.emailed_at).getTime()).not.toBeNaN();
  });

  it('adds the reply-to and BCC addresses when they are configured', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'contact@devartventures.com');
    vi.stubEnv('EMAIL_BCC', 'log@bcc.hubspot.com');
    await post(draft);
    expect(mail.send.mock.calls[0][0]).toMatchObject({ replyTo: 'contact@devartventures.com', bcc: 'log@bcc.hubspot.com' });
  });

  it.each([
    [{ ...draft, business_id: '' }, 'business_id is required'],
    [{ ...draft, subject: ' ' }, 'Add a subject.'],
    [{ ...draft, body: '' }, 'Write a message.'],
    [{ ...draft, subject: 'Hi\nBcc: x@y.com' }, 'The subject must be a single line.'],
    [null, 'business_id is required'],
    ['not an object', 'business_id is required'],
  ])('refuses %j', async (body, error) => {
    expect(await post(body)).toEqual({ status: 400, json: { error } });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("says so when email sending isn't set up", async () => {
    vi.stubEnv('FROM_EMAIL', '');
    expect(await post(draft)).toEqual({
      status: 503,
      json: { error: "Email sending isn't set up — add RESEND_API_KEY and FROM_EMAIL in Vercel." },
    });
  });

  it('needs an email address, an audit and its summary', async () => {
    db.state.business = businessRow({ email: null });
    expect(await post(draft)).toEqual({ status: 400, json: { error: 'This business has no email address.' } });
    db.state.business = businessRow({ audits: null });
    expect(await post(draft)).toEqual({ status: 400, json: { error: 'Run the audit and AI summary first.' } });
    db.state.business = null;
    expect((await post(draft)).status).toBe(404);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("doesn't send without the PDF", async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 500, error: 'Failed to generate PDF' });
    expect(await post(draft)).toEqual({ status: 500, json: { error: 'Failed to generate PDF' } });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("passes on the email service's reason when it refuses, and records nothing", async () => {
    mail.send.mockResolvedValue({ data: null, error: { message: 'The devartventures.com domain is not verified.' } });
    expect(await post(draft)).toEqual({
      status: 502,
      json: { error: "The email wasn't sent: The devartventures.com domain is not verified." },
    });
    expect(db.state.updates).toEqual([]);
  });

  it("says the email service couldn't be reached when the request itself fails", async () => {
    mail.send.mockRejectedValue(new TypeError('fetch failed'));
    expect(await post(draft)).toEqual({ status: 502, json: { error: "The email service couldn't be reached — try again." } });
    expect(db.state.updates).toEqual([]);
  });

  it('still reports the email as sent when the date can not be recorded, so it is not sent twice', async () => {
    db.state.updateError = "Could not find the 'emailed_at' column of 'businesses' in the schema cache";
    const { status, json } = await post(draft);
    expect(status).toBe(200);
    expect(json.emailed_at).toBeTruthy();
    expect(json.warning).toBe("Sent, but Auditely couldn't record it — run docs/migrations/2026-10-02-emailed-at.sql in Supabase.");
  });

  it("doesn't blame the migration when the date can't be saved for another reason", async () => {
    db.state.updateError = 'upstream connect error or disconnect/reset before headers';
    const { status, json } = await post(draft);
    expect(status).toBe(200);
    expect(json.warning).toBe("Sent, but the send date couldn't be saved: after a reload this lead won't show as emailed.");
  });
});
