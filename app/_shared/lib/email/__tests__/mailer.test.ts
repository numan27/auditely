import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emailSetupProblem, sendEmail } from '@/app/_shared/lib/email/mailer';

// Fake mailbox (SMTP): records how it was opened and each email
const smtp = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn() }));
// Fake Resend: records the key and each email
const resend = vi.hoisted(() => ({ send: vi.fn(), keys: [] as string[] }));

vi.mock('nodemailer', () => ({ createTransport: smtp.createTransport }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resend.send };
    constructor(key: string) {
      resend.keys.push(key);
    }
  },
}));

const PDF = Buffer.from('%PDF-1.7');
const email = {
  to: 'office@smiledental.com',
  subject: 'Quick note about your site',
  text: 'Hi there,\nYour site is slow.',
  attachments: [{ filename: 'audit-smile-dental.pdf', content: PDF }],
};
const FROM = 'DevArtVentures <contact@devartventures.com>';
const NOT_SET_UP =
  "Email sending isn't set up — add FROM_EMAIL and your mailbox's SMTP_HOST, SMTP_USER and SMTP_PASS (or RESEND_API_KEY) in Vercel.";
const smtpError = (over: Record<string, unknown>) => Object.assign(new Error('smtp'), over);
const useMailbox = () => {
  vi.stubEnv('SMTP_HOST', 'smtppro.zoho.com');
  vi.stubEnv('SMTP_USER', 'contact@devartventures.com');
  vi.stubEnv('SMTP_PASS', 'app-password');
};

beforeEach(() => {
  for (const name of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_REPLY_TO', 'EMAIL_BCC']) vi.stubEnv(name, '');
  vi.stubEnv('RESEND_API_KEY', 're_key');
  vi.stubEnv('FROM_EMAIL', FROM);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resend.keys.length = 0;
  resend.send.mockReset().mockResolvedValue({ data: { id: 'email-1' }, error: null });
  smtp.sendMail.mockReset().mockResolvedValue({ accepted: [email.to], rejected: [] });
  smtp.createTransport.mockReset().mockReturnValue({ sendMail: smtp.sendMail });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('emailSetupProblem', () => {
  it('is fine with a sender and Resend, or a sender and a full mailbox', () => {
    expect(emailSetupProblem()).toBeNull();
    vi.stubEnv('RESEND_API_KEY', '');
    useMailbox();
    expect(emailSetupProblem()).toBeNull();
  });

  it('needs a sender and a way to send', () => {
    vi.stubEnv('FROM_EMAIL', '');
    expect(emailSetupProblem()).toBe(NOT_SET_UP);
    vi.stubEnv('FROM_EMAIL', FROM);
    vi.stubEnv('RESEND_API_KEY', '');
    expect(emailSetupProblem()).toBe(NOT_SET_UP);
  });

  it("doesn't quietly use Resend when the mailbox is half set up", () => {
    vi.stubEnv('SMTP_HOST', 'smtppro.zoho.com');
    expect(emailSetupProblem()).toBe('Email sending is half set up — SMTP_HOST, SMTP_USER and SMTP_PASS are all needed.');
  });
});

describe('sendEmail through the mailbox (SMTP)', () => {
  beforeEach(useMailbox);

  it('logs in to the mailbox over an encrypted connection and sends from it, not through Resend', async () => {
    expect(await sendEmail(email)).toEqual({ ok: true });
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtppro.zoho.com',
        port: 465,
        secure: true,
        auth: { user: 'contact@devartventures.com', pass: 'app-password' },
      })
    );
    expect(smtp.sendMail).toHaveBeenCalledWith({ from: FROM, ...email });
    expect(resend.send).not.toHaveBeenCalled();
  });

  it('upgrades the connection before logging in on another port', async () => {
    vi.stubEnv('SMTP_PORT', '587');
    await sendEmail(email);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true }));
  });

  it('adds the reply-to and BCC addresses when they are configured', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'numan@devartventures.com');
    vi.stubEnv('EMAIL_BCC', 'log@bcc.hubspot.com');
    await sendEmail(email);
    expect(smtp.sendMail.mock.calls[0][0]).toMatchObject({ replyTo: 'numan@devartventures.com', bcc: 'log@bcc.hubspot.com' });
  });

  it('says the login was refused, with the mailbox\'s own words', async () => {
    smtp.sendMail.mockRejectedValue(smtpError({ code: 'EAUTH', response: '535 Authentication Failed' }));
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error:
        'The mailbox refused the login (535 Authentication Failed) — check SMTP_USER and SMTP_PASS. SMTP_PASS must be an app password when two-step sign-in is on.',
    });
  });

  // Zoho has one server for free accounts and one for paid: the wrong one answers "Access Restricted"
  it('says to try the other Zoho server when this one is not for the account', async () => {
    smtp.sendMail.mockRejectedValue(
      smtpError({ code: 'EAUTH', response: '554 5.7.8 Access Restricted. For more details, check this announcement: https://help.zoho.com/x' })
    );
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error:
        "smtppro.zoho.com isn't the server for this mailbox (554 5.7.8 Access Restricted) — set SMTP_HOST to smtp.zoho.com for a free Zoho account, smtppro.zoho.com for a paid one.",
    });
  });

  it("passes on the mailbox's reason when it refuses the email", async () => {
    smtp.sendMail.mockRejectedValue(smtpError({ code: 'EENVELOPE', response: '553 Relaying disallowed as numan@devartventures.com' }));
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error: "The email wasn't sent: 553 Relaying disallowed as numan@devartventures.com",
    });
  });

  // A connection lost after the email was handed over looks the same as one that never got through
  it("doesn't say 'try again' when the mailbox stopped answering: the email may have gone", async () => {
    smtp.sendMail.mockRejectedValue(smtpError({ code: 'ETIMEDOUT' }));
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error: "The mailbox didn't confirm the email, so it may or may not have gone — check its Sent folder before sending again.",
    });
  });

  it("isn't sent when only the BCC copy was accepted", async () => {
    vi.stubEnv('EMAIL_BCC', 'numan@gmail.com');
    smtp.sendMail.mockResolvedValue({
      accepted: ['numan@gmail.com'],
      rejected: [email.to],
      rejectedErrors: [{ response: '550 5.1.1 Mailbox does not exist' }],
    });
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error: "The email wasn't sent: 550 5.1.1 Mailbox does not exist",
    });
  });

  it("spots the refused lead when the mailbox reports the address in its own spelling, and gives that address's reason", async () => {
    vi.stubEnv('EMAIL_BCC', 'log@bcc.hubspot.com, numan@gmail.com');
    smtp.sendMail.mockResolvedValue({
      accepted: ['numan@gmail.com'],
      rejected: ['log@bcc.hubspot.com', 'Office@smiledental.com'],
      rejectedErrors: [{ response: '554 Relay access denied' }, { response: '550 5.1.1 Mailbox does not exist' }],
    });
    expect(await sendEmail({ ...email, to: ' Office@SmileDental.com' })).toEqual({
      ok: false,
      status: 502,
      error: "The email wasn't sent: 550 5.1.1 Mailbox does not exist",
    });
  });

  it('is sent when only the BCC copy was refused', async () => {
    vi.stubEnv('EMAIL_BCC', 'log@bcc.hubspot.com');
    smtp.sendMail.mockResolvedValue({
      accepted: [email.to],
      rejected: ['log@bcc.hubspot.com'],
      rejectedErrors: [{ response: '554 Relay access denied' }],
    });
    expect(await sendEmail(email)).toEqual({ ok: true });
  });
});

describe('sendEmail through Resend', () => {
  it('sends from FROM_EMAIL with the attachment', async () => {
    expect(await sendEmail(email)).toEqual({ ok: true });
    expect(resend.keys).toEqual(['re_key']);
    expect(resend.send).toHaveBeenCalledWith({ from: FROM, ...email });
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });

  it('adds the reply-to and BCC addresses when they are configured', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'contact@devartventures.com');
    vi.stubEnv('EMAIL_BCC', 'log@bcc.hubspot.com');
    await sendEmail(email);
    expect(resend.send.mock.calls[0][0]).toMatchObject({ replyTo: 'contact@devartventures.com', bcc: 'log@bcc.hubspot.com' });
  });

  it("passes on Resend's reason when it refuses", async () => {
    resend.send.mockResolvedValue({ data: null, error: { message: 'The devartventures.com domain is not verified.' } });
    expect(await sendEmail(email)).toEqual({
      ok: false,
      status: 502,
      error: "The email wasn't sent: The devartventures.com domain is not verified.",
    });
  });

  it("says the email service couldn't be reached when the request itself fails", async () => {
    resend.send.mockRejectedValue(new TypeError('fetch failed'));
    expect(await sendEmail(email)).toEqual({ ok: false, status: 502, error: "The email service couldn't be reached — try again." });
  });
});

describe('sendEmail when sending is not set up', () => {
  it('sends nothing and says what is missing', async () => {
    vi.stubEnv('FROM_EMAIL', '');
    expect(await sendEmail(email)).toEqual({ ok: false, status: 503, error: NOT_SET_UP });
    expect(resend.send).not.toHaveBeenCalled();
  });
});
