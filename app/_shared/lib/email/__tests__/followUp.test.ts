import { describe, it, expect } from 'vitest';
import { followUpDraft, leadDrafts, requestDraft } from '@/app/_shared/lib/email/followUp';
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

describe('requestDraft', () => {
  const aiEmail = `${first}\n\nNuman, DevArtVentures`;

  it('thanks them by first name, points to the problems and offers the 30-minute call', () => {
    const draft = requestDraft({
      businessName: 'smiledental.com',
      request: { name: 'Sarah Jones', main_concern: 'Not enough leads' },
      problems,
      aiEmail,
    });
    expect(draft).toEqual({
      subject: 'Your free website audit for smiledental.com',
      body: [
        'Hi Sarah,',
        'Thanks for requesting a free website audit from DevArtVentures. The report for smiledental.com is attached.',
        "Below are the problems costing you the most customers, and the report shows how we'd fix each one.",
        'You mentioned "Not enough leads" as your main concern. Happy to go through it, and the rest of the report, on a free 30-minute call, or just reply to this email with any questions.',
        'Numan, DevArtVentures',
      ].join('\n\n'),
    });
  });

  it('skips a concern of "Not sure" or none, and points to the scores when no problem was listed', () => {
    for (const main_concern of ['Not sure', null]) {
      const { body } = requestDraft({ businessName: 'smiledental.com', request: { name: 'Sarah', main_concern }, problems: [], aiEmail });
      expect(body).not.toContain('You mentioned');
      expect(body).toContain('It has your scores and the checks behind each one.');
      expect(body).toContain('Happy to walk you through the report on a free 30-minute call');
    }
  });

  it('greets without a name when there is none, and signs as the team without a sign-off', () => {
    const { body } = requestDraft({ businessName: 'x.com', request: { name: '  ', main_concern: null }, problems: [], aiEmail: 'Hi.\n\nCheers' });
    expect(body.startsWith('Hi,\n\n')).toBe(true);
    expect(body.endsWith('\n\nThe DevArtVentures team')).toBe(true);
  });
});

describe('leadDrafts for a requested audit', () => {
  it('replies to the request first, and follows up by name', () => {
    const audit = {
      created_at: '2026-10-01T00:00:00Z', performance_score: null, seo_score: null, mobile_score: null, ssl_valid: null,
      raw_json: {}, engine_version: 99,
      checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'No form' }] } },
    } as unknown as Parameters<typeof leadDrafts>[2];
    const request = { source_id: 'r1', name: 'Sarah Jones', business_type: 'Healthcare', main_concern: 'Slow website', requested_at: '2026-10-27T09:00:00Z' };
    const { first: reply, followUp } = leadDrafts(`Subject: No way to message you\n${first}\n\nNuman, DevArtVentures`, 'smiledental.com', audit, request);
    expect(reply.subject).toBe('Your free website audit for smiledental.com');
    expect(reply.body.startsWith('Hi Sarah,')).toBe(true);
    expect(reply.body.endsWith('Numan, DevArtVentures')).toBe(true);
    expect(followUp.body.startsWith('Hi Sarah,\n\nJust following up')).toBe(true);
  });
});
