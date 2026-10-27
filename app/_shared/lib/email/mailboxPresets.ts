// app/_shared/lib/email/mailboxPresets.ts

// The mailbox an account connects in Settings to send outreach from: the common
// providers' SMTP servers, and the rules for what the form may save. Client-safe:
// the Settings form fills its fields from the presets.

export interface MailboxSettings {
  host: string;
  port: 465 | 587;
  /** The login, usually the mailbox's email address */
  user: string;
  /** An app password; kept exactly as typed */
  pass: string;
  fromEmail: string;
}

export const MAILBOX_PRESETS: { id: 'gmail' | 'outlook' | 'zoho' | 'other'; label: string; host: string; port: 465 | 587; help: string }[] = [
  {
    id: 'gmail',
    label: 'Gmail or Google Workspace',
    host: 'smtp.gmail.com',
    port: 465,
    help: 'Use an app password: Google Account › Security › App passwords. 2-Step Verification must be on.',
  },
  {
    id: 'outlook',
    label: 'Outlook or Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    help: 'Use an app password if two-step verification is on. A Microsoft 365 admin may need to turn on SMTP sign-in for your mailbox.',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 465,
    help: 'A paid Zoho account uses smtppro.zoho.com. Use an app password if two-factor sign-in is on.',
  },
  { id: 'other', label: 'Another provider', host: '', port: 465, help: "Your provider's help pages list its SMTP server and port." },
];

const HOST = /^[a-z0-9.-]+$/;
const HOST_MAX = 253;
const USER_MAX = 254;
const PASS_MAX = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (value: string) => value.length <= USER_MAX && EMAIL.test(value);

const refuse = (error: string) => ({ ok: false as const, error });

export function parseMailbox(body: unknown): { ok: true; mailbox: MailboxSettings } | { ok: false; error: string } {
  const input = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

  const host = text(input.host).toLowerCase();
  if (!host || host.length > HOST_MAX || !HOST.test(host) || !host.includes('.')) {
    return refuse("Enter your mail provider's SMTP server, like smtp.gmail.com.");
  }
  const port = Number(input.port);
  if (port !== 465 && port !== 587) return refuse('The port must be 465 or 587.');
  const user = text(input.user);
  if (!user || user.length > USER_MAX) return refuse("Enter the mailbox's email address.");
  const pass = typeof input.pass === 'string' ? input.pass : '';
  if (!pass.trim() || pass.length > PASS_MAX) return refuse("Enter the mailbox's app password.");
  const fromEmail = text(input.fromEmail) || (isEmail(user) ? user : '');
  if (!isEmail(fromEmail)) return refuse('The From address must be an email address.');

  return { ok: true, mailbox: { host, port, user, pass, fromEmail } };
}
