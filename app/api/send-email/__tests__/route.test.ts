import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/send-email/route';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import { emailSetupProblem, sendEmail } from '@/app/_shared/lib/email/mailer';
import { BRAND_UNAVAILABLE, BrandUnavailable, brandFor, emailLogo } from '@/app/_shared/lib/brand/brand';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { mailboxFor } from '@/app/_shared/lib/email/senders';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

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
const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));
// The sender's brand and its logo; brand.test.ts reads profiles for real
vi.mock('@/app/_shared/lib/brand/brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/brand/brand')>()),
  brandFor: vi.fn(),
  emailLogo: vi.fn(),
}));
// The mailer (mailbox or Resend) has its own tests
vi.mock('@/app/_shared/lib/email/mailer', () => ({ emailSetupProblem: vi.fn(), sendEmail: vi.fn() }));
// The address check (Verifalia) has its own tests
vi.mock('@/app/_shared/lib/email/leadEmailCheck', () => ({ checkLeadEmail: vi.fn() }));
// Which mailbox an account sends from (senders.test.ts reads saved ones for real)
vi.mock('@/app/_shared/lib/email/senders', () => ({ mailboxFor: vi.fn() }));

// The signed-in user's client: the route must hand this one to the libraries
const userDb = { from: db.from };
// Signed in on the Free plan; the client records any query it is asked for
function signInAsMember() {
  const from = vi.fn(db.from);
  session.current = { db: { from }, account: { id: 'user-2', email: 'tester@example.com', isOwner: false } };
  return from;
}

const PDF = Buffer.from('%PDF-1.7');
const LOGO = Buffer.from('logo-png');
const ownerBrand = resolveBrand({ profile: null, isOwner: true, plan: 'owner' });
const acmeBrand = resolveBrand({
  profile: {
    email: 'owner@example.com', display_name: 'Sam', company: 'Acme', website: 'https://acme.studio', logo_data_url: null,
    contact_email: null, contact_phone: null, booking_url: 'https://cal.com/acme',
  },
  isOwner: true,
  plan: 'owner',
});
const businessRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: null, email: 'office@smiledental.com',
  audits: {
    id: 'a1', business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, raw_json: {}, checks: {},
    ai_reports: { id: 'r1', audit_id: 'a1', summary: 'S', improvements: [], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' },
  },
  ...over,
});
const draft = { business_id: 'b1', subject: 'Quick note about your site', body: 'Hi there,\nYour site is slow.' };
const checked = (verdict: string, status: string) => ({
  state: 'checked' as const,
  check: { address: 'office@smiledental.com', verdict, status, checked_at: '2026-10-05T10:00:00Z' },
});
const post = async (body: unknown) => {
  const res = await POST(new NextRequest('https://auditely.app/api/send-email', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  session.current = { db: userDb, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.business = businessRow();
  db.state.updates = [];
  db.state.updateError = null;
  vi.mocked(emailSetupProblem).mockReset().mockReturnValue(null);
  vi.mocked(checkLeadEmail).mockReset().mockResolvedValue({ state: 'off' });
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(brandFor).mockReset().mockResolvedValue(ownerBrand);
  vi.mocked(emailLogo).mockReset().mockResolvedValue({ content: LOGO, contentType: 'image/png', filename: 'brand-logo.png' });
  vi.mocked(renderAuditPdf).mockReset().mockResolvedValue({ ok: true, pdf: PDF, filename: 'audit-smile-dental.pdf' });
  vi.mocked(mailboxFor).mockReset().mockResolvedValue({ ok: true, mailbox: 'env' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/send-email', () => {
  // A function stopped mid-send would leave an email that went out unrecorded
  it('is given a minute, more than the PDF and the slowest send take together', () => {
    expect(maxDuration).toBe(60);
  });

  it("sends the edited email to the business with the PDF attached, and records when", async () => {
    const { status, json } = await post(draft);
    expect(status).toBe(200);
    // No mailbox of its own: the owner's email goes through the Vercel one
    expect(sendEmail).toHaveBeenCalledWith(
      {
        to: 'office@smiledental.com',
        subject: 'Quick note about your site',
        text: expect.stringMatching(/^Hi there,\nYour site is slow\.\n\n---/),
        html: expect.stringContaining('Hi there,<br>Your site is slow.'),
        attachments: [
          { filename: 'audit-smile-dental.pdf', content: PDF },
          { filename: 'brand-logo.png', content: LOGO, cid: 'brand-logo' },
        ],
      },
      undefined
    );
    const { html } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(html).toContain('<img src="cid:brand-logo"');
    expect(html).toContain('DevArtVentures');
    expect(brandFor).toHaveBeenCalledWith('owner-1');
    expect(emailLogo).toHaveBeenCalledWith(ownerBrand);
    expect(html).toContain('Smile Dental');
    expect(html).toContain('Book your free call');
    expect(renderAuditPdf).toHaveBeenCalledWith(userDb, 'a1');
    expect(db.state.updates).toEqual([{ emailed_at: json.emailed_at }]);
    expect(new Date(json.emailed_at).getTime()).not.toBeNaN();
  });

  // They asked for the audit on devartventures.com: no "we won't email again"
  it('tells a requester why the email came instead of offering to stop', async () => {
    db.state.business = businessRow({ request: { source_id: 'req-1', name: 'Sarah', business_type: null, main_concern: null, requested_at: '2026-10-27T09:00:00Z' } });
    expect((await post(draft)).status).toBe(200);
    const { html, text } = vi.mocked(sendEmail).mock.calls[0][0];
    expect(html).toContain('you requested a free website audit on devartventures.com');
    expect(html).not.toContain("we won't email again");
    expect(text).not.toContain("we won't email again");
  });

  it('keeps the opt-out line for a lead', async () => {
    await post(draft);
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("we won't email again");
  });

  it('still sends, without the logo, when the logo file can not be read', async () => {
    vi.mocked(emailLogo).mockResolvedValue(null);
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

  it('sends in the brand the owner’s profile gives, with its own logo type', async () => {
    vi.mocked(brandFor).mockResolvedValue(acmeBrand);
    vi.mocked(emailLogo).mockResolvedValue({ content: LOGO, contentType: 'image/jpeg', filename: 'brand-logo.jpg' });
    expect((await post(draft)).status).toBe(200);
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.html).toContain('>Acme</a>');
    expect(sent.html).toMatch(/<a href="https:\/\/cal\.com\/acme"[^>]*>Book your free call<\/a>/);
    expect(sent.attachments).toContainEqual({ filename: 'brand-logo.jpg', content: LOGO, cid: 'brand-logo' });
    const preview = await post({ ...draft, preview: true });
    expect(preview.json.html).toContain(`<img src="data:image/jpeg;base64,${LOGO.toString('base64')}"`);
  });

  it('sends nothing when the branding can’t be read', async () => {
    vi.mocked(brandFor).mockRejectedValue(new BrandUnavailable('timeout'));
    expect(await post(draft)).toEqual({ status: 503, json: { error: BRAND_UNAVAILABLE } });
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

  it("says so when the owner's Vercel mailbox isn't set up, before drawing the PDF", async () => {
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

  it('never sends to an address Verifalia calls undeliverable, and says why', async () => {
    const undeliverable = checked('Undeliverable', 'MailboxDoesNotExist');
    vi.mocked(checkLeadEmail).mockResolvedValue(undeliverable as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect(await post(draft)).toEqual({
      status: 400,
      json: { error: "Not sent: This mailbox doesn't exist.", email_check: undeliverable.check },
    });
    expect(renderAuditPdf).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
  });

  it('checks the stored address', async () => {
    db.state.business = businessRow({ email_check: { verdict: 'Deliverable' } });
    await post({ ...draft, email: 'someone@else.com' });
    expect(checkLeadEmail).toHaveBeenCalledWith(userDb, { id: 'b1', email: 'office@smiledental.com', email_check: { verdict: 'Deliverable' } });
  });

  it.each([
    ['deliverable', checked('Deliverable', 'Success')],
    ['risky', checked('Risky', 'ServerIsCatchAll')],
    ['unknown', checked('Unknown', 'SmtpConnectionTimeout')],
    ['not checked', { state: 'unchecked' as const, reason: "Not checked: today's free Verifalia checks are used up." }],
    ['Verifalia off', { state: 'off' as const }],
  ])('sends when the address is %s', async (_name, result) => {
    vi.mocked(checkLeadEmail).mockResolvedValue(result as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect((await post(draft)).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('spends no check on a preview, or when the email could not be sent anyway', async () => {
    await post({ ...draft, preview: true });
    vi.mocked(emailSetupProblem).mockReturnValue("Email sending isn't set up.");
    await post(draft);
    db.state.business = businessRow({ audits: null });
    vi.mocked(emailSetupProblem).mockReturnValue(null);
    await post(draft);
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });
});

describe('/api/send-email for other accounts', () => {
  const SAVED = { host: 'smtp.gmail.com', port: 465 as const, user: 'sam@acme.studio', pass: 'app-pass', fromEmail: 'sam@acme.studio' };
  const samProfile = {
    email: 'tester@example.com', display_name: 'Sam Lee', company: 'Acme Studio', website: 'https://acme.studio', logo_data_url: null,
    contact_email: 'hi@acme.studio', contact_phone: null, booking_url: null,
  };
  const samBrand = resolveBrand({ profile: samProfile, isOwner: false, plan: 'pro' });
  const TESTER = { id: 'user-2', email: 'tester@example.com', isOwner: false };
  // A tester on Pro (PLAN_OVERRIDES)
  const signInPaid = (id = 'user-2') => {
    vi.stubEnv('PLAN_OVERRIDES', 'tester@example.com:pro');
    session.current = { db: userDb, account: { ...TESTER, id } };
  };

  beforeEach(() => {
    vi.mocked(brandFor).mockResolvedValue(samBrand);
    vi.mocked(mailboxFor).mockResolvedValue({ ok: true, mailbox: SAVED });
  });

  it('sends a paid account’s email through its own mailbox, in its brand', async () => {
    signInPaid();
    expect((await post(draft)).status).toBe(200);
    expect(brandFor).toHaveBeenCalledWith('user-2');
    expect(mailboxFor).toHaveBeenCalledWith(TESTER);
    const [sent, mailbox] = vi.mocked(sendEmail).mock.calls[0];
    expect(mailbox).toEqual({ settings: SAVED, fromName: 'Sam Lee' });
    expect(sent.html).toContain('>Acme Studio</a>');
    expect(sent.html?.toLowerCase()).not.toContain('devart');
    expect(sent.text.toLowerCase()).not.toContain('devart');
    // The Vercel mailbox is the owner's, so its setup doesn't matter here
    expect(emailSetupProblem).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([{ emailed_at: expect.any(String) }]);
  });

  it('signs as the company when the account gave no name', async () => {
    signInPaid();
    vi.mocked(brandFor).mockResolvedValue(resolveBrand({ profile: { ...samProfile, display_name: null }, isOwner: false, plan: 'pro' }));
    await post(draft);
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toEqual({ settings: SAVED, fromName: 'Acme Studio' });
  });

  it('asks a paid account without a mailbox to connect one', async () => {
    signInPaid();
    vi.mocked(mailboxFor).mockResolvedValue({ ok: false, status: 400, error: 'Connect your mailbox in Settings to send from Auditely.' });
    expect(await post(draft)).toEqual({ status: 400, json: { error: 'Connect your mailbox in Settings to send from Auditely.' } });
    expect(renderAuditPdf).not.toHaveBeenCalled();
    expect(checkLeadEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('asks a paid account without a name to add one', async () => {
    signInPaid();
    vi.mocked(brandFor).mockResolvedValue(resolveBrand({ profile: null, isOwner: false, plan: 'pro' }));
    const error = "Add your name or company in Settings, so the email says who it's from.";
    expect(await post(draft)).toEqual({ status: 400, json: { error } });
    expect(await post({ ...draft, preview: true })).toEqual({ status: 400, json: { error } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('keeps sending from Free accounts', async () => {
    const from = signInAsMember();
    const refused = { status: 403, json: { error: featureMessage('mailbox') } };
    expect(await post(draft)).toEqual(refused);
    expect(await post({ ...draft, preview: true })).toEqual(refused);
    expect(from).not.toHaveBeenCalled();
    expect(brandFor).not.toHaveBeenCalled();
    expect(checkLeadEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('stops a paid account after 50 emails in an hour, counting sends, not previews', async () => {
    signInPaid('user-50');
    await post({ ...draft, preview: true });
    for (let i = 0; i < 50; i++) expect((await post(draft)).status).toBe(200);
    expect(await post(draft)).toEqual({ status: 429, json: { error: "You've sent 50 emails this hour. Try again later." } });
    expect(sendEmail).toHaveBeenCalledTimes(50);
  });

  it('still sends the owner’s email through the Vercel mailbox when nothing is saved', async () => {
    vi.mocked(brandFor).mockResolvedValue(ownerBrand);
    vi.mocked(mailboxFor).mockResolvedValue({ ok: true, mailbox: 'env' });
    expect((await post(draft)).status).toBe(200);
    expect(mailboxFor).toHaveBeenCalledWith({ id: 'owner-1', email: 'owner@example.com', isOwner: true });
    expect(emailSetupProblem).toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toBeUndefined();
  });

  it('sends the owner’s email from a saved mailbox, without needing the Vercel one', async () => {
    vi.mocked(brandFor).mockResolvedValue(ownerBrand);
    vi.mocked(emailSetupProblem).mockReturnValue("Email sending isn't set up.");
    expect((await post(draft)).status).toBe(200);
    expect(vi.mocked(sendEmail).mock.calls[0][1]).toEqual({ settings: SAVED, fromName: ownerBrand.contact!.name ?? 'DevArtVentures' });
  });
});
