// app/_shared/lib/audit/aiReport.ts

// The AI report: the model only sees the impact library's facts, the fixes come
// straight from the library, and a guard asks once more when the model invents
// numbers or writes a long email. Server-side (used by /api/generate).

import type { Problem } from '@/app/_shared/lib/audit/impact';

export interface ReportInput {
  businessName: string;
  website: string;
  /** Worst first (rankedProblems) */
  problems: Problem[];
  /** REPORT_CONTACT_NAME; null signs as the team */
  sender: string | null;
}

export interface WrittenReport {
  summary: string;
  cold_email: string;
}

/** The model's answer wasn't the JSON asked for */
export class InvalidReplyError extends Error {}

const MAX_FIXES = 5;
const PROMPT_PROBLEMS = 5;
// The prompt asks for under 90 words; only a clearly longer body is sent back
const MAX_EMAIL_WORDS = 110;
const NUMBER = /\d+(?:[.,]\d+)*/g;
// No dollar figures: we don't know a prospect's traffic or sales
const MONEY = /[$£€]|\bdollars?\b|\bthousands?\b|\bmillions?\b/i;
const NOTHING_FOUND = 'We found no significant problems in the checks we could run.';

/** Up to 5 fixes, worst problem first; checks the library doesn't know have none */
export function reportFixes(problems: Problem[]): string[] {
  return problems.map((p) => p.fix).filter(Boolean).slice(0, MAX_FIXES);
}

/** The email's closing offer, used word for word */
export function offerSentence({ businessName, problems }: ReportInput): string {
  const fixes = reportFixes(problems).length;
  return fixes > 0
    ? `I put together a short report with ${fixes} fix${fixes === 1 ? '' : 'es'} for ${businessName} — want me to send it over?`
    : `I put together a short report on ${businessName}'s website — want me to send it over?`;
}

const signOff = (sender: string | null) => (sender ? `${sender}, DevArtVentures` : 'The DevArtVentures team');

function factLines(problems: Problem[]): string {
  if (problems.length === 0) return NOTHING_FOUND;
  return problems
    .slice(0, PROMPT_PROBLEMS)
    .map((p, i) =>
      [
        `${i + 1}. ${p.problem}.`,
        p.cost,
        p.evidence && `Measured: ${p.evidence}.`,
        p.stat && `Research: ${p.stat.text} (${p.stat.source})`,
      ]
        .filter(Boolean)
        .join(' ')
    )
    .join('\n');
}

export function buildReportPrompt(input: ReportInput, rejection?: string): string {
  const found = input.problems.length > 0;
  const summaryAsk = found
    ? 'about the most important problems above and what they cost the business.'
    : "saying their website did well in the checks we ran. Don't claim any problem.";
  const opening = found
    ? 'Open with problem 1 and what it costs them; you may mention one more problem briefly.'
    : "Open by saying their website did well in our checks. Don't claim any problem.";
  return `You write for DevArtVentures, a web agency, about a local business's website. Respond in JSON only.

Business: ${input.businessName}
Website: ${input.website}

Problems we found, worst first. These are the ONLY facts you may use:
${factLines(input.problems)}

Write:
1. "summary": 2-3 sentences for the business owner, in plain language, ${summaryAsk}
2. "cold_email": a short cold email to the owner.
   - First line: "Subject: " and a short, specific subject.
   - Body under 90 words. ${opening}
   - End the body with this sentence, word for word: "${offerSentence(input)}"
   - Sign off with: ${signOff(input.sender)}
   - No bullet points.

Rules:
- Use only the facts above. Add no numbers, percentages, prices or dollar amounts that aren't in them.
- Never promise results as certain.
- Don't invent names, people or details about the business.
- Plain English an owner understands: no terms like LCP, schema, JSON-LD, SEO or viewport.${
    rejection ? `\n\nYour previous answer was rejected: ${rejection} Write it again.` : ''
  }

Respond with ONLY valid JSON: {"summary": "...", "cold_email": "..."}`;
}

// The email without its "Subject:" line
const emailBody = (email: string) => email.trimStart().replace(/^subject:[^\n]*/i, '');
// Letters and digits only, so dash style, quotes and line breaks don't matter
const bare = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Numbers the model may use: those in the facts it was given (not their list positions) */
function allowedNumbers(input: ReportInput): Set<string> {
  const facts = input.problems
    .slice(0, PROMPT_PROBLEMS)
    .flatMap((p) => [p.problem, p.cost, p.evidence ?? '', p.stat ? `${p.stat.text} ${p.stat.source}` : '']);
  const text = [...facts, offerSentence(input), input.businessName, input.website, input.sender ?? ''].join(' ');
  return new Set(text.match(NUMBER) ?? []);
}

/** Why a reply must be written again, or null when it's fine */
export function replyProblem(reply: WrittenReport, input: ReportInput): string | null {
  const written = `${reply.summary} ${reply.cold_email}`;
  const allowed = allowedNumbers(input);
  const invented = [...new Set(written.match(NUMBER) ?? [])].filter((n) => !allowed.has(n));
  if (invented.length > 0) return `It used numbers that aren't in the facts (${invented.join(', ')}).`;
  if (MONEY.test(written)) return "It talked about money, which isn't in the facts.";
  const words = emailBody(reply.cold_email).split(/\s+/).filter(Boolean).length;
  if (words > MAX_EMAIL_WORDS) return `The email body is ${words} words; keep it under 90.`;
  if (!bare(reply.cold_email).includes(bare(offerSentence(input)))) return "It didn't end with the offer sentence.";
  const signature = signOff(input.sender);
  return bare(reply.cold_email).includes(bare(signature)) ? null : `It didn't sign off as ${signature}.`;
}

function parseReply(content: string): WrittenReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidReplyError('AI returned invalid JSON');
  }
  const { summary, cold_email } = (parsed ?? {}) as Partial<WrittenReport>;
  if (typeof summary !== 'string' || typeof cold_email !== 'string') throw new InvalidReplyError('AI reply is missing fields');
  return { summary, cold_email };
}

/** Asks the model; asks once more, with the reason, when the answer breaks a rule. The second answer is kept. */
export async function writeReport(complete: (prompt: string) => Promise<string>, input: ReportInput): Promise<WrittenReport> {
  const first = parseReply(await complete(buildReportPrompt(input)));
  const problem = replyProblem(first, input);
  if (!problem) return first;
  return parseReply(await complete(buildReportPrompt(input, problem)));
}
