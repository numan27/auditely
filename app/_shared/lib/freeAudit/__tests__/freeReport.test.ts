import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import demoData from '@/app/_shared/lib/demo/demoData.json';
import { reportFixes } from '@/app/_shared/lib/audit/aiReport';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import type { AuditRow } from '@/app/_shared/lib/audit/types';

const complete = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/audit/groqComplete', () => ({ groqComplete: () => complete }));

const { writeFreeReport } = await import('@/app/_shared/lib/freeAudit/freeReport');

const SAMPLE_ROW = demoData.leads.find((lead) => lead.id === 'demo-b1')!.audit as unknown as AuditRow & { created_at: string };

beforeEach(() => {
  complete.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('writeFreeReport', () => {
  it("writes the summary in Auditely's neutral voice, with the library's fixes", async () => {
    complete.mockResolvedValue(JSON.stringify({ summary: 'Your site is slow on phones.', cold_email: 'Subject: Hi\n\nHello' }));
    const report = await writeFreeReport(SAMPLE_ROW, 'https://www.houstondental.com/', { GROQ_API_KEY: 'k' });
    expect(report?.summary).toBe('Your site is slow on phones.');
    expect(report?.improvements).toEqual(reportFixes(rankedProblems(SAMPLE_ROW)));
    expect(report?.improvements.length).toBeGreaterThan(0);
    const prompt = complete.mock.calls[0][0] as string;
    expect(prompt).toContain('a web consultant');
    expect(prompt).toContain('houstondental.com');
    expect(prompt).not.toMatch(/DevArtVentures/i);
  });

  it('skips the summary without a Groq key, or when Groq fails', async () => {
    expect(await writeFreeReport(SAMPLE_ROW, 'https://www.houstondental.com/', {})).toBeNull();
    expect(complete).not.toHaveBeenCalled();
    complete.mockRejectedValue(new Error('rate limited'));
    expect(await writeFreeReport(SAMPLE_ROW, 'https://www.houstondental.com/', { GROQ_API_KEY: 'k' })).toBeNull();
    expect(console.error).toHaveBeenCalledWith('[free-audit] Summary skipped: rate limited');
    complete.mockResolvedValue('not json');
    expect(await writeFreeReport(SAMPLE_ROW, 'https://www.houstondental.com/', { GROQ_API_KEY: 'k' })).toBeNull();
  });
});
