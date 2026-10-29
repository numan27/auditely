import { describe, it, expect } from 'vitest';
import { followUpDraft, hasPitch, leadDrafts, requestDraft } from '@/app/_shared/lib/email/followUp';
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
const devart = { name: 'DevArtVentures', signOff: 'The DevArtVentures team' };
const acme = { name: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' };
const audit = {
  created_at: '2026-10-01T00:00:00Z', performance_score: null, seo_score: null, mobile_score: null, ssl_valid: null,
  raw_json: {}, engine_version: 99,
  checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'No form' }] } },
} as unknown as Parameters<typeof leadDrafts>[2];
const base = { businessName: 'Smile Dental', problems: [] as Problem[] };

describe('followUpDraft', () => {
  it('reminds them of the report and its worst problem, signed like the first email', () => {
    expect(followUpDraft({ businessName: 'Smile Dental', problems, firstEmail: `${first}\n\nNuman, DevArtVentures`, sender: devart })).toEqual({
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
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: `${first}\n\nThe DevArtVentures team`, sender: devart });
    expect(body).toBe(
      [
        'Hi,',
        "Just following up on the website report I sent for Smile Dental. I've attached it again in case it got buried.",
        'Happy to walk you through it on a quick call.',
        'The DevArtVentures team',
      ].join('\n\n')
    );
  });

  it('signs with the sender’s sign-off when the first email has none of its own', () => {
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: 'Hi there.\n\nCheers', sender: devart });
    expect(body.endsWith('\n\nThe DevArtVentures team')).toBe(true);
  });

  it('keeps a sign-off written over two lines', () => {
    const { body } = followUpDraft({ businessName: 'Smile Dental', problems: [], firstEmail: `${first}\n\nNuman\nDevArtVentures`, sender: devart });
    expect(body.endsWith('\n\nNuman\nDevArtVentures')).toBe(true);
  });

  it('signs the follow-up like the first email, written over two lines or one', () => {
    expect(followUpDraft({ ...base, firstEmail: 'Hi,\n\nSlow site.\n\nSam Lee\nAcme Studio', sender: acme }).body.endsWith('Sam Lee\nAcme Studio')).toBe(true);
    expect(followUpDraft({ ...base, firstEmail: 'Hi,\n\nSlow site.\n\nSam Lee, Acme Studio', sender: acme }).body.endsWith('\n\nSam Lee, Acme Studio')).toBe(true);
  });

  it('signs with the sender’s sign-off when the first email has another', () => {
    expect(followUpDraft({ ...base, firstEmail: 'Hi,\n\nSlow site.\n\nNuman, DevArtVentures', sender: acme }).body.endsWith('Sam Lee, Acme Studio')).toBe(true);
  });

  it('keeps no paragraph longer than a sign-off, even one naming the sender', () => {
    const long = `Acme Studio fixes websites like yours, and ${'we would love to help '.repeat(3)}`;
    expect(followUpDraft({ ...base, firstEmail: `Hi,\n\n${long}`, sender: acme }).body.endsWith('\n\nSam Lee, Acme Studio')).toBe(true);
  });
});

describe('leadDrafts', () => {
  it("gives the first email and a follow-up about the audit's worst problem", () => {
    const { first: firstDraft, followUp } = leadDrafts(`Subject: No way to message you\n${first}\n\nNuman, DevArtVentures`, 'Smile Dental', audit, null, devart);
    expect(firstDraft.subject).toBe('No way to message you');
    expect(followUp.subject).toBe('Quick follow-up on your website report');
    expect(followUp.body).toContain('We found no contact form or email link on your site.');
    expect(followUp.body.endsWith('Numan, DevArtVentures')).toBe(true);
  });

  it('never signs a Free account’s drafts as DevArtVentures', () => {
    const { first: firstDraft, followUp } = leadDrafts('Subject: Hi\n\nSlow site.\n\n[Your name]', 'Smile', audit);
    expect(`${firstDraft.body}${followUp.body}`.toLowerCase()).not.toContain('devart');
    expect(followUp.body.endsWith('[Your name]')).toBe(true);
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
      sender: devart,
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
      const { body } = requestDraft({ businessName: 'smiledental.com', request: { name: 'Sarah', main_concern }, problems: [], aiEmail, sender: devart });
      expect(body).not.toContain('You mentioned');
      expect(body).toContain('It has your scores and the checks behind each one.');
      expect(body).toContain('Happy to walk you through the report on a free 30-minute call');
    }
  });

  it('greets without a name when there is none, and signs as the team without a sign-off', () => {
    const { body } = requestDraft({ businessName: 'x.com', request: { name: '  ', main_concern: null }, problems: [], aiEmail: 'Hi.\n\nCheers', sender: devart });
    expect(body.startsWith('Hi,\n\n')).toBe(true);
    expect(body.endsWith('\n\nThe DevArtVentures team')).toBe(true);
  });

  it('thanks them in the name the owner’s profile gives', () => {
    const { body } = requestDraft({ businessName: 'x.com', request: { name: 'Sarah', main_concern: null }, problems: [], aiEmail: 'Hi.\n\nSam Lee, Acme Studio', sender: acme });
    expect(body).toContain('Thanks for requesting a free website audit from Acme Studio.');
    expect(body.endsWith('\n\nSam Lee, Acme Studio')).toBe(true);
  });
});

describe('leadDrafts for a requested audit', () => {
  it('replies to the request first, and follows up by name', () => {
    const request = { source_id: 'r1', name: 'Sarah Jones', business_type: 'Healthcare', main_concern: 'Slow website', requested_at: '2026-10-27T09:00:00Z' };
    const { first: reply, followUp } = leadDrafts(`Subject: No way to message you\n${first}\n\nNuman, DevArtVentures`, 'smiledental.com', audit, request, devart);
    expect(reply.subject).toBe('Your free website audit for smiledental.com');
    expect(reply.body.startsWith('Hi Sarah,')).toBe(true);
    expect(reply.body.endsWith('Numan, DevArtVentures')).toBe(true);
    expect(followUp.body.startsWith('Hi Sarah,\n\nJust following up')).toBe(true);
  });
});

// A website with nothing to fix has nothing to pitch, so it gets no cold email
describe('hasPitch', () => {
  it('is true when the report lists something to fix', () => {
    expect(hasPitch(['Compress the images.'])).toBe(true);
  });

  it('is false for a report with nothing to fix', () => {
    expect(hasPitch([])).toBe(false);
    expect(hasPitch([], null, null)).toBe(false);
  });

  it('still answers someone who asked for the audit, and follows up a lead already emailed', () => {
    const request = { name: 'Sarah' } as unknown as Parameters<typeof hasPitch>[1];
    expect(hasPitch([], request)).toBe(true);
    expect(hasPitch([], null, '2026-10-20T00:00:00Z')).toBe(true);
  });
});
