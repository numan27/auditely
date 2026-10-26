import { describe, it, expect } from 'vitest';
import { outreachHtml, outreachText, type OutreachEmail } from '@/app/_shared/lib/email/outreachEmail';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';

const finding = (id: string, status: 'fail' | 'warn' = 'fail') => ({ id, status, label: id });
const audit = (over: Partial<AuditLike> = {}): AuditLike => ({
  created_at: '2026-10-01T00:00:00Z',
  performance_score: 91,
  mobile_score: 45,
  seo_score: 62,
  ssl_valid: true,
  geo_score: null,
  aeo_score: 30,
  lead_score: 55,
  raw_json: {},
  engine_version: 99,
  checks: {
    lead: { findings: [finding('lead.form'), finding('lead.clickToCall'), finding('lead.brokenLinks'), finding('lead.contactPage')] },
  } as AuditLike['checks'],
  ...over,
});
const email = (over: Partial<OutreachEmail> = {}): OutreachEmail => ({
  body: 'Hi,\n\nYour site is slow.\nIt loses visitors.\n\nNuman, DevArtVentures',
  business: { name: 'Smile Dental', website: 'https://www.smiledental.com/' },
  audit: audit(),
  contact: { name: 'Numan', phone: '+1 555 0100', email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/devart/15min' },
  logoSrc: 'cid:devartventures-logo',
  ...over,
});

describe('outreachHtml', () => {
  it('keeps the message as written: a paragraph per blank line, line breaks inside', () => {
    const html = outreachHtml(email());
    expect(html).toContain('>Hi,</p>');
    expect(html).toContain('>Your site is slow.<br>It loses visitors.</p>');
    expect(html).toContain('>Numan, DevArtVentures</p>');
  });

  // The line an inbox shows beside the subject: the sender's own words, nothing they can't see in the dialog
  it('gives the inbox the opening of the message as its preview line', () => {
    const html = outreachHtml(email({ body: `Hi,\n\n${'Your site is slow. '.repeat(20)}` }));
    const hidden = html.match(/<div style="display:none[^>]*>([^<]*)<\/div>/)?.[1] ?? '';
    expect(hidden.startsWith('Hi, Your site is slow. Your site is slow.')).toBe(true);
    expect(hidden.length).toBeLessThanOrEqual(140);
  });

  it('gives Outlook the button padding and the card width it would otherwise ignore', () => {
    const html = outreachHtml(email());
    expect(html).toMatch(/<td bgcolor="#15172a" style="[^"]*mso-padding-alt:13px 28px;/);
    expect(html).toMatch(/<!--\[if mso\]><table [^>]*width="600" align="center">/);
    expect(html).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });

  it('never lets the message, the business or the contact details carry markup', () => {
    const html = outreachHtml(
      email({
        body: 'Hi <script>alert(1)</script> & "you"',
        business: { name: 'Smile <b>Dental</b>', website: 'https://x.com/"onmouseover="alert(1)' },
        contact: { name: '<i>N</i>', phone: null, email: 'a@b.com', bookingUrl: 'https://cal.com/x?a=1&b="2"' },
      })
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hi &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;you&quot;');
    expect(html).toContain('Smile &lt;b&gt;Dental&lt;/b&gt;');
    expect(html).not.toContain('"onmouseover="');
    expect(html).toContain('href="https://cal.com/x?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain('&lt;i&gt;N&lt;/i&gt;');
  });

  it('carries the DevArtVentures header with the logo, or without it when the logo is missing', () => {
    expect(outreachHtml(email())).toContain('<img src="cid:devartventures-logo"');
    const bare = outreachHtml(email({ logoSrc: null }));
    expect(bare).not.toContain('<img');
    expect(bare).toContain('DevArtVentures');
  });

  it('shows the measured scores in owner language, coloured good, needs work or poor', () => {
    const html = outreachHtml(email());
    const tile = (label: string) => html.match(new RegExp(`color:(#[0-9a-f]{6});[^>]*>([^<]+)</div><div[^>]*>${label}<`))?.slice(1);
    expect(tile('Desktop speed')).toEqual(['#16a34a', '91']);
    expect(tile('Phone speed')).toEqual(['#dc2626', '45']);
    expect(tile('Google search')).toEqual(['#d97706', '62']);
    expect(tile('Secure \\(https\\)')).toEqual(['#16a34a', '✓']);
    expect(tile('Direct answers')).toEqual(['#dc2626', '30']);
    expect(tile('Easy to reach')).toEqual(['#d97706', '55']);
    // Not measured: left out rather than shown as a dash
    expect(html).not.toContain('AI search');
  });

  it('marks a site without a valid certificate, and leaves out what old audits never measured', () => {
    expect(outreachHtml(email({ audit: audit({ ssl_valid: false }) }))).toMatch(/color:#dc2626;[^>]*>✕<\/div><div[^>]*>Secure \(https\)</);
    const old = outreachHtml(email({ audit: audit({ engine_version: 1 }) }));
    expect(old).not.toContain('Google search');
    expect(old).not.toContain('Secure (https)');
  });

  it('lists the three worst problems with what they cost, and the website', () => {
    const html = outreachHtml(email());
    expect(html).toContain('We found no contact form or email link on your site');
    expect(html).toContain('have no easy way to reach you online.');
    expect(html).toContain("Your phone number isn't set up as a call link");
    expect(html).toContain('Some links on your site lead to a missing page');
    expect(html).not.toContain('Your homepage has no link to a contact page');
    expect(html).toContain('>smiledental.com</a>');
  });

  it('has no problem list or scores when the audit found and measured nothing', () => {
    const html = outreachHtml(
      email({ audit: audit({ performance_score: null, mobile_score: null, seo_score: null, ssl_valid: null, aeo_score: null, lead_score: null, checks: {} }) })
    );
    expect(html).not.toContain('costing you customers');
    expect(html).not.toContain('Scores are out of 100');
    expect(html).toContain('Book your free call');
  });

  it('links the button to the booking page, or to an email when there is none', () => {
    expect(outreachHtml(email())).toMatch(/<a href="https:\/\/calendly\.com\/devart\/15min"[^>]*>Book your free call<\/a>/);
    const noBooking = outreachHtml(email({ contact: { name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null } }));
    expect(noBooking).toMatch(/<a href="mailto:contact@devartventures\.com"[^>]*>Book your free call<\/a>/);
  });

  it('ends with the company details and a way to opt out', () => {
    const html = outreachHtml(email());
    expect(html).toContain('href="https://devartventures.com"');
    expect(html).toContain('Numan');
    expect(html).toContain('+1 555 0100');
    expect(html).toContain('href="mailto:contact@devartventures.com"');
    expect(html).toContain("we won't email again");
    expect(html).not.toContain('requested a free website audit');
  });

  // They asked for it: an opt-out line would read as if they hadn't
  it('tells someone who requested the audit why it came, instead of offering to stop', () => {
    const html = outreachHtml(email({ requested: true }));
    expect(html).toContain('You received this because you requested a free website audit on devartventures.com.');
    expect(html).not.toContain("we won't email again");
    expect(html).toContain('Book your free call');
  });

  it('offers the same 30-minute call as devartventures.com', () => {
    expect(outreachHtml(email())).toContain('free 30-minute call');
    expect(outreachHtml(email())).not.toContain('15-minute');
  });

  // The site's light theme: ink on white and mist, no old navy or purple, no all-caps labels
  it('is in the light DevArtVentures colours, with labels in sentence case', () => {
    const html = outreachHtml(email());
    expect(html).not.toMatch(/#000529|#530fff|text-transform:uppercase/i);
    expect(html).toContain('background:#f4f5f8;');
    expect(html).toMatch(/<td width="25%" height="4" bgcolor="#2fbf7d"/);
    expect(html).toMatch(/<p style="[^"]*color:#15172a;">Your website at a glance<\/p>/);
  });
});

describe('outreachText', () => {
  it('gives mail clients without HTML the message, the snapshot, the booking link and the company', () => {
    const text = outreachText(email());
    expect(text.startsWith('Hi,\n\nYour site is slow.\nIt loses visitors.\n\nNuman, DevArtVentures\n')).toBe(true);
    expect(text).toContain('Desktop speed 91/100');
    expect(text).toContain('Secure (https): yes');
    expect(text).toContain('- We found no contact form or email link on your site.');
    expect(text).toContain('Book your free call: https://calendly.com/devart/15min');
    const noBooking = outreachText(email({ contact: { name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null } }));
    expect(noBooking).toContain('Book your free call: reply to this email');
    expect(noBooking).not.toContain('mailto:');
    expect(text).toContain('DevArtVentures · https://devartventures.com');
    expect(text).toContain("we won't email again");
    expect(text).toContain('free 30-minute call');
  });

  it('ends a requested audit with why it came, not the opt-out line', () => {
    const text = outreachText(email({ requested: true }));
    expect(text).toContain('You received this because you requested a free website audit on devartventures.com.');
    expect(text).not.toContain("we won't email again");
  });
});
