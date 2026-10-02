// app/_shared/lib/email/followUp.ts

// The follow-up for a lead that was already emailed: a short reminder of the
// report and its worst problem, in the impact library's words (nothing is
// written by the AI, so nothing can be invented). Client-safe.

import { rankedProblems, type Problem } from '@/app/_shared/lib/audit/impact';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import { outreachDraft, type OutreachDraft } from '@/app/_shared/lib/email/outreach';

interface FollowUpInput {
  businessName: string;
  /** Worst first (rankedProblems) */
  problems: Problem[];
  /** The first email's message, for its sign-off */
  firstEmail: string;
}

const TEAM = 'The DevArtVentures team';

// The first email ends with "Name, DevArtVentures" or the team's sign-off
function signOff(firstEmail: string): string {
  const last = firstEmail.trim().split(/\n\s*\n/).pop() ?? '';
  return last.includes('DevArtVentures') && last.length <= 80 ? last : TEAM;
}

export function followUpDraft({ businessName, problems, firstEmail }: FollowUpInput): OutreachDraft {
  const worst = problems[0];
  const paragraphs = [
    'Hi,',
    `Just following up on the website report I sent for ${businessName}. I've attached it again in case it got buried.`,
    worst && `One thing worth fixing first:\n${[`${worst.problem}.`, worst.cost].filter(Boolean).join(' ')}`,
    `Happy to walk you through ${worst ? 'the rest' : 'it'} on a quick call.`,
    signOff(firstEmail),
  ];
  return { subject: 'Quick follow-up on your website report', body: paragraphs.filter(Boolean).join('\n\n') };
}

/** A lead's two emails: the AI's first one, and the follow-up for once that has been sent */
export function leadDrafts(coldEmail: string, businessName: string, audit: AuditLike): { first: OutreachDraft; followUp: OutreachDraft } {
  const first = outreachDraft(coldEmail, businessName);
  return { first, followUp: followUpDraft({ businessName, problems: rankedProblems(audit), firstEmail: first.body }) };
}
