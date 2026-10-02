import { describe, it, expect } from 'vitest';
import { followUpDraft, leadDrafts } from '@/app/_shared/lib/email/followUp';
import type { Problem } from '@/app/_shared/lib/audit/impact';

const problems: Problem[] = [
  {
    id: 'lead.form',
    problem: 'We found no contact form or email link on your site',
    cost: "Visitors who'd rather write than call have no easy way to reach you online.",
    fix: 'Add a short contact form.',
  },
  { id: 'perf.slow', problem: 'Your site is slow to load on phones', cost: 'Visitors leave.', fix: 'Speed it up.' },
];
const first = "Hi, your site is slow. I've attached a short report — happy to walk you through it on a quick call.";

describe('followUpDraft', () => {
  it('reminds them of the report and its worst problem, signed like the first email', () => {
    expect(followUpDraft({ businessName: 'Smile Dental', problems, firstEmail: `${first}\n\nNuman, DevArtVentures` })).toEqual({
      subject: 'Quick follow-up on your website report',
      body: [
        "Hi,",
        "Just following up on the website report I sent for Smile Dental. I've attached it again in case it got buried.",
        "One thing worth fixing first:\nWe found no contact form or email link on your site. Visitors who'd rather write than call have no easy way to reach you online.",
        'Happy to walk you through the rest on a quick call.',
        'Numan, DevArtVentures',
      ].join('\n\n'),
    });
  });

  it('leaves out the problem when the audit found none', () => {
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: `${first}\n\nThe DevArtVentures team` });
    expect(body).toBe(
      [
        'Hi,',
        "Just following up on the website report I sent for Smile Dental. I've attached it again in case it got buried.",
        'Happy to walk you through it on a quick call.',
        'The DevArtVentures team',
      ].join('\n\n')
    );
  });

  it('signs as the team when the first email has no DevArtVentures sign-off', () => {
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: 'Hi there.\n\nCheers' });
    expect(body.endsWith('\n\nThe DevArtVentures team')).toBe(true);
  });

  it('keeps a sign-off written over two lines', () => {
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: `${first}\n\nNuman\nDevArtVentures` });
    expect(body.endsWith('\n\nNuman\nDevArtVentures')).toBe(true);
  });
});

describe('leadDrafts', () => {
  it("gives the first email and a follow-up about the audit's worst problem", () => {
    const audit = {
      created_at: '2026-10-01T00:00:00Z', performance_score: null, seo_score: null, mobile_score: null, ssl_valid: null,
      raw_json: {}, engine_version: 99,
      checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'No form' }] } },
    } as unknown as Parameters<typeof leadDrafts>[2];
    const { first: firstDraft, followUp } = leadDrafts(`Subject: No way to message you\n${first}\n\nNuman, DevArtVentures`, 'Smile Dental', audit);
    expect(firstDraft.subject).toBe('No way to message you');
    expect(followUp.subject).toBe('Quick follow-up on your website report');
    expect(followUp.body).toContain('We found no contact form or email link on your site.');
    expect(followUp.body.endsWith('Numan, DevArtVentures')).toBe(true);
  });
});
