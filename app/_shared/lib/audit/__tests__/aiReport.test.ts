import { describe, it, expect, vi } from 'vitest';
import {
  buildReportPrompt,
  InvalidReplyError,
  offerSentence,
  replyProblem,
  reportFixes,
  writeReport,
  type ReportInput,
} from '@/app/_shared/lib/audit/aiReport';
import type { Problem } from '@/app/_shared/lib/audit/impact';

const problem = (n: number, over: Partial<Problem> = {}): Problem => ({
  id: `p${n}`,
  problem: `Problem ${'abcdef'[n]}`,
  cost: `Cost ${'abcdef'[n]}.`,
  fix: `Fix ${'abcdef'[n]}.`,
  ...over,
});
const slow = problem(0, {
  problem: 'Your site is slow to load on phones',
  evidence: 'Real visitors on phones wait about 4.1 s',
  stat: { text: '53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load.', source: 'Think with Google, 2016' },
});
const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: 'Smile Dental',
  website: 'https://smiledental.com',
  problems: [slow, problem(1), problem(2)],
  sender: 'Numan',
  ...over,
});
// An email that ends as asked: the offer sentence, then the sign-off
const signed = (body: string, i: ReportInput = input()) => `Subject: Hi\n\n${body} ${offerSentence(i)}\n\nNuman, DevArtVentures`;
const reply = (cold_email: string, summary = 'Your site is slow on phones.') => ({ summary, cold_email });

describe('reportFixes and offerSentence', () => {
  it('takes up to 5 fixes, worst problem first, skipping checks without one', () => {
    const problems = [problem(0), problem(1, { fix: '' }), problem(2), problem(3), problem(4), problem(5), problem(1)];
    expect(reportFixes(problems)).toEqual(['Fix a.', 'Fix c.', 'Fix d.', 'Fix e.', 'Fix f.']);
  });

  it('offers a report with the number of fixes, or a plain report when there are none', () => {
    expect(offerSentence(input())).toBe('I put together a short report with 3 fixes for Smile Dental — want me to send it over?');
    expect(offerSentence(input({ problems: [problem(0)] }))).toBe('I put together a short report with 1 fix for Smile Dental — want me to send it over?');
    expect(offerSentence(input({ problems: [] }))).toBe("I put together a short report on Smile Dental's website — want me to send it over?");
  });
});

describe('buildReportPrompt', () => {
  it('gives the model only the ranked facts, the offer and the sign-off', () => {
    const prompt = buildReportPrompt(input());
    const first = prompt.indexOf('1. Your site is slow to load on phones.');
    expect(first).toBeGreaterThan(-1);
    expect(prompt.indexOf('2. Problem b.')).toBeGreaterThan(first);
    expect(prompt).toContain('Measured: Real visitors on phones wait about 4.1 s.');
    expect(prompt).toContain('Research: 53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load. (Think with Google, 2016)');
    expect(prompt).toContain(offerSentence(input()));
    expect(prompt).toContain('Sign off with: Numan, DevArtVentures');
    expect(buildReportPrompt(input({ sender: null }))).toContain('Sign off with: The DevArtVentures team');
  });

  it('asks for an honest positive note, and no problems, when nothing was found', () => {
    const prompt = buildReportPrompt(input({ problems: [] }));
    expect(prompt).toContain('We found no significant problems in the checks we could run.');
    expect(prompt).toContain("Don't claim any problem.");
    expect(prompt).not.toContain('Open with problem 1');
  });

  it('passes on why a previous answer was rejected', () => {
    expect(buildReportPrompt(input(), 'It used numbers that aren\'t in the facts (40).')).toContain(
      "Your previous answer was rejected: It used numbers that aren't in the facts (40)."
    );
  });
});

describe('replyProblem', () => {
  it('accepts numbers from the facts, written in other forms too', () => {
    expect(replyProblem(reply(signed('Visitors wait 4.1s; 53% leave after a 3-second wait.')), input())).toBeNull();
  });

  it('accepts digits from the business name and website', () => {
    const named = input({ businessName: 'Smile 4 U Dental', website: 'https://dental32.com' });
    expect(replyProblem(reply(signed('I looked at dental32.com for Smile 4 U.', named)), named)).toBeNull();
  });

  it('rejects numbers that are not in the facts', () => {
    expect(replyProblem(reply(signed('You are losing $2,000 a month and 40% of visitors.')), input())).toBe(
      "It used numbers that aren't in the facts (2,000, 40)."
    );
  });

  it("doesn't take the facts' list positions for facts", () => {
    expect(replyProblem(reply(signed('About 1 in 3 callers give up.')), input())).toBe("It used numbers that aren't in the facts (1).");
  });

  it('rejects talk of money, even without digits', () => {
    expect(replyProblem(reply(signed('This could be costing you thousands of dollars.')), input())).toBe(
      "It talked about money, which isn't in the facts."
    );
  });

  it('rejects an email body well over 90 words, not counting the subject', () => {
    const long = `Subject: ${'word '.repeat(30)}\n\n${'word '.repeat(111)}`;
    expect(replyProblem(reply(long), input())).toBe('The email body is 111 words; keep it under 90.');
    expect(replyProblem(reply(signed('word '.repeat(85))), input())).toBeNull();
  });

  it('requires the offer sentence and the sign-off, in any dash or line style', () => {
    const offer = offerSentence(input()).replace('—', '-');
    expect(replyProblem(reply(`Subject: Hi\n\nYour site is slow. ${offer}\n\nNuman\nDevArtVentures`), input())).toBeNull();
    expect(replyProblem(reply('Subject: Hi\n\nYour site is slow.\n\nNuman, DevArtVentures'), input())).toBe(
      "It didn't end with the offer sentence."
    );
    expect(replyProblem(reply(`Subject: Hi\n\nYour site is slow. ${offer}\n\nAlex, DevArtVentures`), input())).toBe(
      "It didn't sign off as Numan, DevArtVentures."
    );
  });
});

describe('writeReport', () => {
  const answer = (cold_email: string) => JSON.stringify(reply(cold_email));

  it('keeps a good first answer', async () => {
    const complete = vi.fn(async () => answer(signed('Your site is slow.')));
    expect(await writeReport(complete, input())).toEqual(reply(signed('Your site is slow.')));
    expect(complete).toHaveBeenCalledOnce();
  });

  it('retries once with the reason, and keeps the second answer', async () => {
    const complete = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce(answer(signed('You lose 40% of visitors.')))
      .mockResolvedValueOnce(answer(signed('Visitors leave before it loads.')));
    expect((await writeReport(complete, input())).cold_email).toBe(signed('Visitors leave before it loads.'));
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0]).toContain("It used numbers that aren't in the facts (40).");
  });

  it('throws InvalidReplyError when the model does not answer with the JSON asked for', async () => {
    await expect(writeReport(vi.fn(async () => 'Sure! Here is the email'), input())).rejects.toBeInstanceOf(InvalidReplyError);
    await expect(writeReport(vi.fn(async () => '{"summary": "x"}'), input())).rejects.toBeInstanceOf(InvalidReplyError);
  });
});
