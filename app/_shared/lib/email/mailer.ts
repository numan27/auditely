// app/_shared/lib/email/mailer.ts

// Sends one email. An account that connected its own mailbox sends through it,
// from its own address and name (email/mailbox.ts checks the server first).
// Otherwise it goes from FROM_EMAIL: with SMTP_HOST set, through that mailbox's
// own server (Zoho: smtp.zoho.com for a free account, smtppro.zoho.com for a paid
// one); without it, through Resend. A mailbox keeps a copy in its Sent folder;
// Resend keeps none.

import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { isZohoWrongServer, mailTransport, resolveMailHost, zohoServerSentence, type MailLookup } from '@/app/_shared/lib/email/mailbox';
import type { MailboxSettings } from '@/app/_shared/lib/email/mailboxPresets';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  /** The designed version; `text` is what mail clients without HTML show */
  html?: string;
  /** Where replies go, over EMAIL_REPLY_TO: a tester's own address on their feedback */
  replyTo?: string;
  /** With a `cid`, an image placed inside the message (<img src="cid:…">) instead of listed as a file */
  attachments: { filename: string; content: Buffer; cid?: string }[];
}
export type SendResult = { ok: true } | { ok: false; status: number; error: string };

/** An account's own mailbox, and the name its email goes out under */
export interface UserMailbox {
  settings: MailboxSettings;
  fromName: string;
}

// The owner's email (FROM_EMAIL); an account's own goes out under its name and address
type EnvMessage = OutgoingEmail & { from: string; replyTo?: string; bcc?: string };
type Message = EnvMessage | (OutgoingEmail & { from: { name: string; address: string } });

/** What a refused login says: which settings to fix differs between the owner's and an account's mailbox */
interface SmtpCopy {
  wrongServer: (response: string) => string;
  loginRefused: (answer: string) => string;
}

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

function envTransport(): Transporter {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT) || 465;
  return createTransport({
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
}

const ENV_COPY: SmtpCopy = {
  wrongServer: (response) =>
    `${process.env.SMTP_HOST} isn't the server for this mailbox (${response.split('. ')[0]}) — set SMTP_HOST to smtp.zoho.com for a free Zoho account, smtppro.zoho.com for a paid one.`,
  loginRefused: (answer) =>
    `The mailbox refused the login${answer} — check SMTP_USER and SMTP_PASS. SMTP_PASS must be an app password when two-step sign-in is on.`,
};

async function viaSmtp(mailbox: Transporter, message: Message, copy: SmtpCopy): Promise<SendResult> {
  try {
    const info = await mailbox.sendMail(message);
    // With a BCC the server can accept the copy and still refuse the lead's address,
    // which it reports in its own spelling (trimmed, domain in lower case)
    const lead = message.to.trim().toLowerCase();
    const lost = (info.rejected ?? []).findIndex((address) => String(address).trim().toLowerCase() === lead);
    if (lost === -1) return { ok: true };
    return refused(info.rejectedErrors?.[lost]?.response ?? `${message.to} was refused`);
  } catch (err) {
    // `response` is the mail server's own answer
    const { code, response, message: detail } = err as Error & { code?: string; response?: string };
    console.error('[send-email] smtp failed:', code, response ?? detail);
    // Zoho's answer from the server that isn't the one for the account's plan
    if (isZohoWrongServer(code, response)) return { ok: false, status: 502, error: copy.wrongServer(response!) };
    if (code === 'EAUTH') return { ok: false, status: 502, error: copy.loginRefused(response ? ` (${response})` : '') };
    return response ? refused(response) : UNCONFIRMED;
  }
}

async function viaResend(message: EnvMessage, apiKey: string): Promise<SendResult> {
  try {
    // Resend reports a refusal (unverified domain, bad address) in `error` instead of throwing
    // Resend calls an inline image's id `contentId`
    const attachments = message.attachments.map(({ cid, ...file }) => (cid ? { ...file, contentId: cid } : file));
    const { error } = await new Resend(apiKey).emails.send({ ...message, attachments });
    if (!error) return { ok: true };
    console.error('[send-email] refused:', error.message);
    return refused(error.message);
  } catch (err) {
    console.error('[send-email] failed:', err instanceof Error ? err.message : err);
    return UNREACHABLE;
  }
}

async function viaUserMailbox(email: OutgoingEmail, { settings, fromName }: UserMailbox, lookup?: MailLookup): Promise<SendResult> {
  // Looked up on every send: the name may point somewhere else since it was saved
  const resolved = await resolveMailHost(settings.host, lookup);
  if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
  // The account's own address and name; EMAIL_BCC and EMAIL_REPLY_TO are the owner's alone
  const message: Message = { ...email, from: { name: fromName, address: settings.fromEmail } };
  return viaSmtp(mailTransport(settings, resolved.address), message, {
    wrongServer: () => `${zohoServerSentence(settings.host)} Change it in Settings.`,
    loginRefused: (answer) => `Your mailbox refused the login${answer}. Check the email address and app password in Settings.`,
  });
}

/** @param mailbox the account's own; without one, the owner's mailbox or Resend from the environment */
export async function sendEmail(email: OutgoingEmail, mailbox?: UserMailbox, lookup?: MailLookup): Promise<SendResult> {
  if (mailbox) return viaUserMailbox(email, mailbox, lookup);

  const { FROM_EMAIL: from, SMTP_HOST, RESEND_API_KEY, EMAIL_REPLY_TO, EMAIL_BCC: bcc } = process.env;
  const problem = emailSetupProblem();
  if (problem || !from) return { ok: false, status: 503, error: problem ?? NOT_SET_UP };

  // The email's own reply-to (a tester's, on their feedback) wins over the owner's
  const replyTo = email.replyTo || EMAIL_REPLY_TO;
  const message: EnvMessage = { from, ...email, ...(replyTo && { replyTo }), ...(bcc && { bcc }) };
  return SMTP_HOST ? viaSmtp(envTransport(), message, ENV_COPY) : viaResend(message, RESEND_API_KEY ?? '');
}
