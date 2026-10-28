// app/_shared/lib/feedback/feedback.ts

// A tester's note to the owner during the beta: what makes a message sendable,
// the page it was written on, the email the owner gets (replies go straight to
// the tester), and the browser's call to send it. Client-safe.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { OutgoingEmail } from '@/app/_shared/lib/email/mailer';

export const FEEDBACK_MAX = 3000;
const PAGE_MAX = 200;

const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";
export const FEEDBACK_FAILED = "Couldn't send your feedback. Try again in a minute.";

/** What's wrong with the message, or null when it can go */
export function feedbackProblem(message: string): string | null {
  const text = message.trim();
  if (!text) return 'Write a message first.';
  if (text.length > FEEDBACK_MAX) return `Keep it under ${FEEDBACK_MAX.toLocaleString('en-US')} characters.`;
  return null;
}

/** The page the message was written on, when it's a path on this site */
export function feedbackPage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > PAGE_MAX) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

interface FeedbackNote {
  /** OWNER_EMAIL */
  to: string;
  message: string;
  /** The tester's email, which replies go to */
  from: string;
  /** Their plan's name: Free, or the one PLAN_OVERRIDES gave them */
  plan: string;
  page: string | null;
  sentAt: Date;
}

export function feedbackEmail({ to, message, from, plan, page, sentAt }: FeedbackNote): OutgoingEmail {
  const details = [`From: ${from}`, `Plan: ${plan}`, `Page: ${page ?? 'not given'}`, `Sent: ${sentAt.toUTCString()}`];
  return {
    to,
    replyTo: from,
    subject: `Auditely feedback from ${from}`,
    text: `${message.trim()}\n\n${details.join('\n')}`,
    attachments: [],
  };
}

export type FeedbackAnswer = { ok: true } | { ok: false; error: string };

/** Sends the message, with the page it was written on; a failure carries the server's own words */
export async function sendFeedback(message: string, page: string): Promise<FeedbackAnswer> {
  let res: Response;
  try {
    res = await fetch(API_ROUTES.FEEDBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, page }),
    });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  if (res.ok) return { ok: true };
  const answer = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return { ok: false, error: typeof answer?.error === 'string' ? answer.error : FEEDBACK_FAILED };
}
