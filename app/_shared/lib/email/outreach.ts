// app/_shared/lib/email/outreach.ts

// The outreach email as it is sent: subject and message, taken from the AI's
// draft, edited in the "Send email" dialog and checked again on the server.

export interface OutreachDraft {
  subject: string;
  body: string;
}

export const SUBJECT_MAX = 150;
export const BODY_MAX = 5000;

// The AI's email ends with the offer (aiReport's offerSentence: "… want me to
// send it over?") and then the sign-off, which it often leaves on the same line
const SIGN_OFF_ON_OFFER_LINE = /(want me to send it over\?)[ \t]+(?=\S)/i;

/**
 * The AI writes "Subject: ..." as the first line of its email. That becomes
 * the subject and the rest the message, with the sign-off in a paragraph of
 * its own; an email without a subject line gets one naming the business.
 */
export function outreachDraft(coldEmail: string, businessName: string): OutreachDraft {
  const [firstLine, ...rest] = coldEmail.trim().split('\n');
  const subject = firstLine.match(/^\s*subject:\s*(.+)$/i)?.[1].trim();
  const body = (subject ? rest.join('\n') : coldEmail).trim().replace(SIGN_OFF_ON_OFFER_LINE, '$1\n\n');
  return { subject: subject ?? `A few quick fixes for the ${businessName} website`, body };
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
