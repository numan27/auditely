// app/_shared/lib/email/mailer.ts

// Sends one email from FROM_EMAIL. With SMTP_HOST set it goes out through the
// mailbox's own server (Zoho: smtp.zoho.com for a free account, smtppro.zoho.com
// for a paid one), which keeps a copy in the mailbox's Sent folder. Without it,
// through Resend, which keeps none.

import { createTransport } from 'nodemailer';
import { Resend } from 'resend';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Buffer }[];
}
export type SendResult = { ok: true } | { ok: false; status: number; error: string };

type Message = OutgoingEmail & { from: string; replyTo?: string; bcc?: string };

const NOT_SET_UP =
  "Email sending isn't set up — add FROM_EMAIL and your mailbox's SMTP_HOST, SMTP_USER and SMTP_PASS (or RESEND_API_KEY) in Vercel.";
const UNREACHABLE: SendResult = { ok: false, status: 502, error: "The email service couldn't be reached — try again." };
// A connection lost after the email was handed over looks the same as one that never got through
const UNCONFIRMED: SendResult = {
  ok: false,
  status: 502,
  error: "The mailbox didn't confirm the email, so it may or may not have gone — check its Sent folder before sending again.",
};
const refused = (reason: string): SendResult => ({ ok: false, status: 502, error: `The email wasn't sent: ${reason}` });

/** What is missing before an email can be sent, or null when sending is set up */
export function emailSetupProblem(): string | null {
  const { FROM_EMAIL, SMTP_HOST, SMTP_USER, SMTP_PASS, RESEND_API_KEY } = process.env;
  // Half a mailbox setup must not quietly go through Resend: the Sent folder would stay empty
  if (SMTP_HOST || SMTP_USER || SMTP_PASS) {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return 'Email sending is half set up — SMTP_HOST, SMTP_USER and SMTP_PASS are all needed.';
  } else if (!RESEND_API_KEY) {
    return NOT_SET_UP;
  }
  return FROM_EMAIL ? null : NOT_SET_UP;
}

async function viaSmtp(message: Message): Promise<SendResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT) || 465;
  const mailbox = createTransport({
    host: SMTP_HOST,
    port,
    // 465 is encrypted from the start; any other port must upgrade before the password is sent
    secure: port === 465,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Together well inside the route's time limit
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  try {
    const info = await mailbox.sendMail(message);
    // With a BCC the server can accept the copy and still refuse the lead's address,
    // which it reports in its own spelling (trimmed, domain in lower case)
    const lead = message.to.trim().toLowerCase();
    const lost = info.rejected.findIndex((address) => String(address).trim().toLowerCase() === lead);
    if (lost === -1) return { ok: true };
    return refused(info.rejectedErrors?.[lost]?.response ?? `${message.to} was refused`);
  } catch (err) {
    // `response` is the mail server's own answer
    const { code, response, message: detail } = err as Error & { code?: string; response?: string };
    console.error('[send-email] smtp failed:', code, response ?? detail);
    // Zoho's answer from the server that isn't the one for the account's plan
    if (code === 'EAUTH' && response && /access restricted/i.test(response)) {
      return {
        ok: false,
        status: 502,
        error: `${SMTP_HOST} isn't the server for this mailbox (${response.split('. ')[0]}) — set SMTP_HOST to smtp.zoho.com for a free Zoho account, smtppro.zoho.com for a paid one.`,
      };
    }
    if (code === 'EAUTH') {
      const answer = response ? ` (${response})` : '';
      return {
        ok: false,
        status: 502,
        error: `The mailbox refused the login${answer} — check SMTP_USER and SMTP_PASS. SMTP_PASS must be an app password when two-step sign-in is on.`,
      };
    }
    return response ? refused(response) : UNCONFIRMED;
  }
}

async function viaResend(message: Message, apiKey: string): Promise<SendResult> {
  try {
    // Resend reports a refusal (unverified domain, bad address) in `error` instead of throwing
    const { error } = await new Resend(apiKey).emails.send(message);
    if (!error) return { ok: true };
    console.error('[send-email] refused:', error.message);
    return refused(error.message);
  } catch (err) {
    console.error('[send-email] failed:', err instanceof Error ? err.message : err);
    return UNREACHABLE;
  }
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const { FROM_EMAIL: from, SMTP_HOST, RESEND_API_KEY, EMAIL_REPLY_TO: replyTo, EMAIL_BCC: bcc } = process.env;
  const problem = emailSetupProblem();
  if (problem || !from) return { ok: false, status: 503, error: problem ?? NOT_SET_UP };

  const message: Message = { from, ...email, ...(replyTo && { replyTo }), ...(bcc && { bcc }) };
  return SMTP_HOST ? viaSmtp(message) : viaResend(message, RESEND_API_KEY ?? '');
}
