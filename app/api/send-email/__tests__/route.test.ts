import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/send-email/route';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import { emailSetupProblem, sendEmail } from '@/app/_shared/lib/email/mailer';
import { brandLogo } from '@/app/_shared/lib/email/brandLogo';

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
vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));
vi.mock('@/app/_shared/lib/email/brandLogo', () => ({ LOGO_CID: 'devartventures-logo', brandLogo: vi.fn() }));
// The mailer (mailbox or Resend) has its own tests
vi.mock('@/app/_shared/lib/email/mailer', () => ({ emailSetupProblem: vi.fn(), sendEmail: vi.fn() }));

const PDF = Buffer.from('%PDF-1.7');
const LOGO = Buffer.from('logo-png');
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.business = businessRow();
  db.state.updates = [];
  db.state.updateError = null;
  vi.mocked(emailSetupProblem).mockReset().mockReturnValue(null);
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(brandLogo).mockReset().mockResolvedValue(LOGO);
  vi.mocked(renderAuditPdf).mockReset().mockResolvedValue({ ok: true, pdf: PDF, filename: 'audit-smile-dental.pdf' });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/send-email', () => {
  // A function stopped mid-send would leave an email that went out unrecorded
  it('is given a minute, more than the PDF and the slowest send take together', () => {
    expect(maxDuration).toBe(60);
  });

  it("sends the edited email to the business with the PDF attached, and records when", async () => {
    const { status, json } = await post(draft);
    expect(status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'office@smiledental.com',
      subject: 'Quick note about your site',
      text: expect.stringMatching(/^Hi there,\nYour site is slow\.\n\n---/),
      html: expect.stringContaining('Hi there,<br>Your site is slow.'),
      attachments: [
        { filename: 'audit-smile-dental.pdf', content: PDF },
        { filename: 'devartventures-logo.png', content: LOGO, cid: 'devartventures-logo' },
      ],
    });
    const { html } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(html).toContain('<img src="cid:devartventures-logo"');
    expect(html).toContain('Smile Dental');
    expect(html).toContain('Book your free call');
    expect(renderAuditPdf).toHaveBeenCalledWith('a1');
    expect(db.state.updates).toEqual([{ emailed_at: json.emailed_at }]);
    expect(new Date(json.emailed_at).getTime()).not.toBeNaN();
  });

  it('still sends, without the logo, when the logo file can not be read', async () => {
    vi.mocked(brandLogo).mockResolvedValue(null);
    expect((await post(draft)).status).toBe(200);
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.attachments).toEqual([{ filename: 'audit-smile-dental.pdf', content: PDF }]);
    expect(sent.html).not.toContain('<img');
  });

  it('shows the email as it will look, without sending or needing email to be set up', async () => {
    vi.mocked(emailSetupProblem).mockReturnValue("Email sending isn't set up.");
    const { status, json } = await post({ ...draft, preview: true });
    expect(status).toBe(200);
    expect(json.html).toContain('Hi there,<br>Your site is slow.');
    // A browser can't load the email's attached logo, so the preview carries the image itself
    expect(json.html).toContain(`<img src="data:image/png;base64,${LOGO.toString('base64')}"`);
    expect(renderAuditPdf).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
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
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("says so when email sending isn't set up, before doing any work", async () => {
    vi.mocked(emailSetupProblem).mockReturnValue("Email sending isn't set up.");
    expect(await post(draft)).toEqual({ status: 503, json: { error: "Email sending isn't set up." } });
    expect(renderAuditPdf).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('needs an email address, an audit and its summary', async () => {
    db.state.business = businessRow({ email: null });
    expect(await post(draft)).toEqual({ status: 400, json: { error: 'This business has no email address.' } });
    db.state.business = businessRow({ audits: null });
    expect(await post(draft)).toEqual({ status: 400, json: { error: 'Run the audit and AI summary first.' } });
    db.state.business = null;
    expect((await post(draft)).status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't send without the PDF", async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 500, error: 'Failed to generate PDF' });
    expect(await post(draft)).toEqual({ status: 500, json: { error: 'Failed to generate PDF' } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("passes on the mailer's reason when the email isn't sent, and records nothing", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, status: 502, error: "The email wasn't sent: 553 Relaying disallowed" });
    expect(await post(draft)).toEqual({ status: 502, json: { error: "The email wasn't sent: 553 Relaying disallowed" } });
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
