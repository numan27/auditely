// The contact page: five fields, four of them required, a hidden field only a
// script fills, and a way to send.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactForm } from '@/app/_shared/components/contact/contactForm';
import ContactPage, { metadata } from '@/app/(pages)/(legal)/contact/page';

const form = renderToStaticMarkup(createElement(ContactForm));
const tagFor = (html: string, label: string) => {
  const id = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>\\s*${label.replace(/[()]/g, '\\$&')}`))?.[1];
  return id ? html.match(new RegExp(`<(?:input|textarea)[^>]*id="${id}"[^>]*>`))?.[0] ?? '' : '';
};

describe('ContactForm', () => {
  it('asks for a name, email, phone, subject and message', () => {
    expect(tagFor(form, 'Name')).toMatch(/autoComplete="name"/);
    expect(tagFor(form, 'Email')).toMatch(/type="email"/);
    expect(tagFor(form, 'Phone (optional)')).toMatch(/type="tel"/);
    expect(tagFor(form, 'Subject')).not.toBe('');
    expect(tagFor(form, 'Message')).toMatch(/^<textarea/);
  });

  it('marks every field but the phone as required', () => {
    for (const label of ['Name', 'Email', 'Subject', 'Message']) {
      expect(tagFor(form, label), label).toMatch(/aria-required="true"|required=""/);
    }
    const phone = tagFor(form, 'Phone (optional)');
    expect(phone).toMatch(/^<input/);
    expect(phone).not.toMatch(/aria-required="true"|required=""/);
  });

  it('checks the fields itself, so each problem shows under its field', () => {
    expect(form).toMatch(/<form[^>]*noValidate=""/);
  });

  it('hides a field from people and screen readers that a script would fill', () => {
    const trap = form.match(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(trap).toMatch(/<input[^>]*name="website"/);
    expect(trap).toMatch(/tabindex="-1"|tabIndex="-1"/);
    expect(trap).toMatch(/autoComplete="off"/);
  });

  it('sends with one button', () => {
    expect(form).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*Send message[\s\S]*<\/button>/);
  });
});

describe('the contact page', () => {
  it('says what the form is for, above it', () => {
    const page = renderToStaticMarkup(createElement(ContactPage));
    expect(page).toMatch(/<h1[^>]*>Contact us<\/h1>/);
    expect(page).toContain('Questions about Auditely or the beta? Send us a message and we&#x27;ll reply by email.');
    expect(page).toContain('name="website"');
  });

  it('may be found by search engines', () => {
    expect(metadata).toMatchObject({ title: 'Contact', robots: { index: true, follow: true } });
  });
});
