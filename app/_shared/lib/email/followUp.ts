// app/_shared/lib/email/followUp.ts

// The follow-up for a lead that was already emailed: a short reminder of the
// report and its worst problem, in the impact library's words (nothing is
// written by the AI, so nothing can be invented). Also the reply to someone who
// requested the audit on devartventures.com, which replaces the AI's cold
// email for them. Client-safe.

import { rankedProblems, type Problem } from '@/app/_shared/lib/audit/impact';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import { outreachDraft, type OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { AuditRequest } from '@/app/_shared/lib/types/auditely';

interface FollowUpInput {
  businessName: string;
  /** Worst first (rankedProblems) */
  problems: Problem[];
  /** The first email's message, for its sign-off */
  firstEmail: string;
  /** The requester's name, for the greeting; a lead's is unknown */
  name?: string;
}

interface RequestReplyInput {
  /** The website without "www.", as the card shows it */
  businessName: string;
  request: Pick<AuditRequest, 'name' | 'main_concern'>;
  /** Worst first (rankedProblems) */
  problems: Problem[];
  /** The AI's email, for its sign-off */
  aiEmail: string;
}

const TEAM = 'The DevArtVentures team';

// The first email ends with "Name, DevArtVentures" or the team's sign-off
function signOff(firstEmail: string): string {
  const last = firstEmail.trim().split(/\n\s*\n/).pop() ?? '';
  return last.includes('DevArtVentures') && last.length <= 80 ? last : TEAM;
}

// "Hi Sarah," from "Sarah Jones"; just "Hi," without a name
const greeting = (name?: string) => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : 'Hi,';
};

const worstProblem = (worst: Problem) => [`${worst.problem}.`, worst.cost].filter(Boolean).join(' ');

// The form's "Not sure" says nothing to answer
const NO_CONCERN = /^not sure$/i;

export function followUpDraft({ businessName, problems, firstEmail, name }: FollowUpInput): OutreachDraft {
  const worst = problems[0];
  const paragraphs = [
    greeting(name),
    `Just following up on the website report I sent for ${businessName}. I've attached it again in case it got buried.`,
    worst && `One thing worth fixing first:\n${worstProblem(worst)}`,
    `Happy to walk you through ${worst ? 'the rest' : 'it'} on a quick call.`,
    signOff(firstEmail),
  ];
  return { subject: 'Quick follow-up on your website report', body: paragraphs.filter(Boolean).join('\n\n') };
}

/**
 * The reply to an audit requested on devartventures.com: they asked, so it
 * thanks them instead of pitching. The problems themselves are in the email's
 * snapshot below the message (outreachEmail.ts), so it points there.
 */
export function requestDraft({ businessName, request, problems, aiEmail }: RequestReplyInput): OutreachDraft {
  const concern = request.main_concern?.trim();
  const call = 'a free 30-minute call, or just reply to this email with any questions';
  const paragraphs = [
    greeting(request.name),
    `Thanks for requesting a free website audit from DevArtVentures. The report for ${businessName} is attached.`,
    problems.length > 0
      ? "Below are the problems costing you the most customers, and the report shows how we'd fix each one."
      : 'It has your scores and the checks behind each one.',
    concern && !NO_CONCERN.test(concern)
      ? `You mentioned "${concern}" as your main concern. Happy to go through it, and the rest of the report, on ${call}.`
      : `Happy to walk you through the report on ${call}.`,
    signOff(aiEmail),
  ];
  return { subject: `Your free website audit for ${businessName}`, body: paragraphs.join('\n\n') };
}

/**
 * A lead's two emails: the AI's first one, and the follow-up for once that has
 * been sent. A requested audit's first email is the reply to the request.
 */
export function leadDrafts(
  coldEmail: string,
  businessName: string,
  audit: AuditLike,
  request?: AuditRequest | null
): { first: OutreachDraft; followUp: OutreachDraft } {
  const problems = rankedProblems(audit);
  const ai = outreachDraft(coldEmail, businessName);
  const first = request ? requestDraft({ businessName, request, problems, aiEmail: ai.body }) : ai;
  return { first, followUp: followUpDraft({ businessName, problems, firstEmail: first.body, name: request?.name }) };
}
