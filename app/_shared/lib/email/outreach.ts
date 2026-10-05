// app/_shared/lib/email/outreach.ts

// The outreach email as it is sent: subject and message, taken from the AI's
// draft, edited in the "Send email" dialog and checked again on the server.

export interface OutreachDraft {
  subject: string;
  body: string;
}

export const SUBJECT_MAX = 150;
export const BODY_MAX = 5000;

/** How the AI's offer sentence ends (aiReport's offerSentence): the PDF goes with the email, so it offers the call */
export const OFFER_CLOSING = 'happy to walk you through it on a quick call.';

// Reports written before the PDF went with the email offered to send it instead
const OLD_OFFER = /I put together (a short report[^\n]*?)\s*[—–-]+\s*want me to send it over\?/i;
// Longer than this gets cut off in an inbox
const SHORT_SUBJECT = 50;

// The sign-off follows the offer, and the AI often leaves it on the same line or the next
function signOffInOwnParagraph(body: string): string {
  const offer = body.toLowerCase().lastIndexOf(OFFER_CLOSING);
  if (offer === -1) return body;
  const end = offer + OFFER_CLOSING.length;
  const signOff = body.slice(end).trimStart();
  return signOff ? `${body.slice(0, end)}\n\n${signOff}` : body;
}

/**
 * The AI writes "Subject: ..." as the first line of its email. That becomes
 * the subject and the rest the message, with the sign-off in a paragraph of
 * its own; an email without a subject line gets one naming the business
 * (when that stays short).
 */
export function outreachDraft(coldEmail: string, businessName: string): OutreachDraft {
  // The AI sometimes answers with Windows line endings
  const email = coldEmail.replace(/\r\n?/g, '\n').trim();
  const [firstLine, ...rest] = email.split('\n');
  const subject = firstLine.match(/^\s*subject:\s*(.+)$/i)?.[1].trim();
  const body = signOffInOwnParagraph(
    (subject ? rest.join('\n') : email).trim().replace(OLD_OFFER, `I've attached $1 — ${OFFER_CLOSING}`)
  );
  const named = `A few quick fixes for the ${businessName} website`;
  return { subject: subject ?? (named.length <= SHORT_SUBJECT ? named : 'A few quick fixes for your website'), body };
}

/** Why this email can't be sent as it is; null when it can */
export function outreachProblem({ subject, body }: OutreachDraft): string | null {
  if (!subject.trim()) return 'Add a subject.';
  // A line break would let the subject carry extra email headers
  if (/[\r\n]/.test(subject)) return 'The subject must be a single line.';
  if (subject.length > SUBJECT_MAX) return `Keep the subject under ${SUBJECT_MAX} characters.`;
  if (!body.trim()) return 'Write a message.';
  if (body.length > BODY_MAX) return `Keep the message under ${BODY_MAX} characters.`;
  return null;
}
