import { describe, it, expect } from 'vitest';
import { BODY_MAX, outreachDraft, outreachProblem, SUBJECT_MAX } from '@/app/_shared/lib/email/outreach';
import { offerSentence } from '@/app/_shared/lib/audit/aiReport';

describe('outreachDraft', () => {
  it('takes the subject from the first line and leaves the rest as the message', () => {
    const draft = outreachDraft('Subject: Quick note about your site\n\nHi there,\nYour site is slow.\n\nNuman', 'Smile Dental');
    expect(draft).toEqual({ subject: 'Quick note about your site', body: 'Hi there,\nYour site is slow.\n\nNuman' });
  });

  it('reads the subject line in any case, with space around it', () => {
    expect(outreachDraft('  SUBJECT:   Hello  \nBody', 'Smile Dental')).toEqual({ subject: 'Hello', body: 'Body' });
  });

  it('falls back to a subject naming the business when the email has none', () => {
    expect(outreachDraft('Hi there,\nYour site is slow.', 'Smile Dental')).toEqual({
      subject: 'A few quick fixes for the Smile Dental website',
      body: 'Hi there,\nYour site is slow.',
    });
  });
});

describe('outreachDraft layout', () => {
  // The AI often runs the sign-off into the offer sentence that ends its email
  const offer = offerSentence({ businessName: 'Smile Dental', website: 'https://smiledental.com', problems: [], sender: null });

  it('puts a sign-off that follows the offer on the same line into its own paragraph', () => {
    const { body } = outreachDraft(`Subject: Hi\nHi, your site is slow. ${offer} The DevArtVentures team`, 'Smile Dental');
    expect(body).toBe(`Hi, your site is slow. ${offer}\n\nThe DevArtVentures team`);
  });

  it('leaves an email alone when the sign-off already has its own line', () => {
    const email = `Hi,\n\nYour site is slow. ${offer}\n\nNuman, DevArtVentures`;
    expect(outreachDraft(`Subject: Hi\n\n${email}`, 'Smile Dental').body).toBe(email);
  });
});

describe('outreachProblem', () => {
  const draft = { subject: 'Quick note', body: 'Hi there' };

  it('accepts a subject and a message', () => {
    expect(outreachProblem(draft)).toBeNull();
  });

  it('asks for a subject and a message', () => {
    expect(outreachProblem({ ...draft, subject: '  ' })).toBe('Add a subject.');
    expect(outreachProblem({ ...draft, body: '\n ' })).toBe('Write a message.');
  });

  it('refuses a subject with a line break, which could smuggle in email headers', () => {
    expect(outreachProblem({ ...draft, subject: 'Hello\nBcc: someone@else.com' })).toBe('The subject must be a single line.');
  });

  it('keeps the subject and message to a sensible length', () => {
    expect(outreachProblem({ ...draft, subject: 'x'.repeat(SUBJECT_MAX + 1) })).toBe(`Keep the subject under ${SUBJECT_MAX} characters.`);
    expect(outreachProblem({ ...draft, body: 'x'.repeat(BODY_MAX + 1) })).toBe(`Keep the message under ${BODY_MAX} characters.`);
  });
});
