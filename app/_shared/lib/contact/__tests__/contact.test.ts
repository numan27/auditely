// The contact form's rules: what makes a message sendable, what is read from a
// request, and the email the team gets, which they answer straight to the sender.

import { describe, it, expect } from 'vitest';
import { CONTACT_MESSAGE_MAX, contactEmail, contactFieldsFrom, contactProblems, type ContactFields } from '@/app/_shared/lib/contact/contact';

const filled: ContactFields = {
  name: 'Sam Rivera',
  email: 'sam@example.com',
  phone: '',
  subject: 'A question about the beta',
  message: 'Can my whole team use one account?',
};

describe('contactProblems', () => {
  it('passes a filled form, with or without a phone number', () => {
    expect(contactProblems(filled)).toEqual({});
    expect(contactProblems({ ...filled, phone: '+1 (555) 010-2030' })).toEqual({});
  });

  it('asks for the name, email, subject and message', () => {
    expect(contactProblems({ name: ' ', email: '', phone: '', subject: '', message: '  ' })).toEqual({
      name: 'Enter your name.',
      email: 'Enter your email.',
      subject: 'Enter a subject.',
      message: 'Write a message.',
    });
  });

  it('says how an email should look', () => {
    expect(contactProblems({ ...filled, email: 'sam@example' })).toEqual({ email: 'Enter an email like name@company.com.' });
    expect(contactProblems({ ...filled, email: 'sam@example.com\nBcc: x@example.com' }).email).toBe(
      'Enter an email like name@company.com.'
    );
  });

  it('takes a phone number of digits and the usual marks, or none', () => {
    expect(contactProblems({ ...filled, phone: 'call me' })).toEqual({ phone: 'Enter a phone number, or leave it blank.' });
    expect(contactProblems({ ...filled, phone: '12' })).toEqual({ phone: 'Enter a phone number, or leave it blank.' });
  });

  it('keeps each field to a sensible length', () => {
    expect(contactProblems({ ...filled, message: 'x'.repeat(CONTACT_MESSAGE_MAX + 1) })).toEqual({
      message: 'Keep it under 5,000 characters.',
    });
    expect(contactProblems({ ...filled, subject: 'x'.repeat(151) })).toEqual({ subject: 'Keep it under 150 characters.' });
    expect(contactProblems({ ...filled, name: 'x'.repeat(101) })).toEqual({ name: 'Keep it under 100 characters.' });
  });
});

describe('contactFieldsFrom', () => {
  it('reads the five fields, trimmed, and leaves out anything else', () => {
    expect(contactFieldsFrom({ ...filled, name: '  Sam Rivera ', extra: 'x' })).toEqual(filled);
  });

  it('reads a missing or non-text field as empty', () => {
    expect(contactFieldsFrom({ name: 7 })).toEqual({ name: '', email: '', phone: '', subject: '', message: '' });
    expect(contactFieldsFrom(null)).toEqual({ name: '', email: '', phone: '', subject: '', message: '' });
  });
});

describe('contactEmail', () => {
  const sentAt = new Date('2026-10-28T15:00:00.000Z');

  it('goes to the team, with replies to the sender', () => {
    const email = contactEmail({ to: 'team@example.com', fields: filled, sentAt });
    expect(email).toMatchObject({ to: 'team@example.com', replyTo: 'sam@example.com', attachments: [] });
    expect(email.subject).toBe('Auditely contact: A question about the beta');
    expect(email.text).toBe(
      [
        'Can my whole team use one account?',
        '',
        'From: Sam Rivera <sam@example.com>',
        'Phone: not given',
        'Sent: Wed, 28 Oct 2026 15:00:00 GMT',
      ].join('\n')
    );
  });

  it('gives the phone number when there is one, and keeps the subject on one line', () => {
    const email = contactEmail({
      to: 'team@example.com',
      fields: { ...filled, phone: '+1 555 010 2030', subject: 'Two\r\nlines' },
      sentAt,
    });
    expect(email.text).toContain('Phone: +1 555 010 2030');
    expect(email.subject).toBe('Auditely contact: Two lines');
  });
});
