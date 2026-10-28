// app/_shared/lib/contact/contact.ts

// The public contact form: what makes a message sendable, the fields read from a
// request, the email the team gets (replies go straight to the sender), and the
// browser's call to send it. Client-safe.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { OutgoingEmail } from '@/app/_shared/lib/email/mailer';

export interface ContactFields {
  name: string;
  email: string;
  /** Optional: empty when not given */
  phone: string;
  subject: string;
  message: string;
}

export type ContactField = keyof ContactFields;
export type ContactProblems = Partial<Record<ContactField, string>>;

export const CONTACT_MESSAGE_MAX = 5000;
const MAX: Record<ContactField, number> = { name: 100, email: 254, phone: 40, subject: 150, message: CONTACT_MESSAGE_MAX };
const FIELDS = Object.keys(MAX) as ContactField[];

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
// Digits with the usual marks between them, at least seven digits in all
const PHONE = /^\+?[\d\s().-]+$/;

const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";
export const CONTACT_FAILED = "Couldn't send your message. Try again in a minute.";

const tooLong = (field: ContactField) => `Keep it under ${MAX[field].toLocaleString('en-US')} characters.`;

/** What's wrong with each field, empty when the message can go */
export function contactProblems(fields: ContactFields): ContactProblems {
  const problems: ContactProblems = {};
  const name = fields.name.trim();
  const email = fields.email.trim();
  const phone = fields.phone.trim();
  const subject = fields.subject.trim();
  const message = fields.message.trim();

  if (!name) problems.name = 'Enter your name.';
  if (!email) problems.email = 'Enter your email.';
  else if (!EMAIL.test(email)) problems.email = 'Enter an email like name@company.com.';
  if (phone && (!PHONE.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    problems.phone = 'Enter a phone number, or leave it blank.';
  }
  if (!subject) problems.subject = 'Enter a subject.';
  if (!message) problems.message = 'Write a message.';

  for (const field of FIELDS) {
    if (!problems[field] && fields[field].trim().length > MAX[field]) problems[field] = tooLong(field);
  }
  return problems;
}

/** The five fields from a request's body, trimmed; anything missing or not text is empty */
export function contactFieldsFrom(body: unknown): ContactFields {
  const values = (body ?? {}) as Record<string, unknown>;
  const read = (field: ContactField) => (typeof values[field] === 'string' ? (values[field] as string).trim() : '');
  return { name: read('name'), email: read('email'), phone: read('phone'), subject: read('subject'), message: read('message') };
}

interface ContactNote {
  /** OWNER_EMAIL */
  to: string;
  fields: ContactFields;
  sentAt: Date;
}

export function contactEmail({ to, fields, sentAt }: ContactNote): OutgoingEmail {
  const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
  const details = [
    `From: ${oneLine(fields.name)} <${fields.email}>`,
    `Phone: ${fields.phone || 'not given'}`,
    `Sent: ${sentAt.toUTCString()}`,
  ];
  return {
    to,
    replyTo: fields.email,
    subject: `Auditely contact: ${oneLine(fields.subject)}`,
    text: `${fields.message.trim()}\n\n${details.join('\n')}`,
    attachments: [],
  };
}

export type ContactAnswer = { ok: true } | { ok: false; error: string; problems?: ContactProblems };

/**
 * Sends the message; trap is the form's hidden field, which only a script fills.
 * A failure carries the server's own words.
 */
export async function sendContact(fields: ContactFields, trap: string): Promise<ContactAnswer> {
  let res: Response;
  try {
    res = await fetch(API_ROUTES.CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, website: trap }),
    });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  if (res.ok) return { ok: true };
  const answer = (await res.json().catch(() => null)) as { error?: unknown; problems?: ContactProblems } | null;
  return {
    ok: false,
    error: typeof answer?.error === 'string' ? answer.error : CONTACT_FAILED,
    ...(answer?.problems ? { problems: answer.problems } : {}),
  };
}
