import { describe, it, expect } from 'vitest';
import { analyzeLeadCapture, type LeadPage } from '@/app/_shared/lib/audit/analyzers/leadCapture';
import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { LeadPageKind } from '@/app/_shared/lib/audit/types';

const SITE = 'https://smiledental.com';
const home = (html: string): LeadPage => ({ url: `${SITE}/`, kind: 'home', html });
const keyPage = (kind: LeadPageKind, html: string | null): LeadPage => ({ url: `${SITE}/${kind}`, kind, html });
const link = (path: string, status: LinkResult['status'] = 'ok'): LinkResult => ({ url: `${SITE}${path}`, status });

const run = (pages: LeadPage[], links: LinkResult[] = [link('/x')]) => analyzeLeadCapture(pages, links);
const finding = (result: ReturnType<typeof analyzeLeadCapture>, id: string) =>
  result.checks.findings.find((f) => f.id === id);

const CONTACT_FORM =
  '<form action="/send"><input name="name"><input type="email" name="email"><textarea name="message"></textarea></form>';

describe('analyzeLeadCapture', () => {
  it('gives 100 to a site with every way to reach it', () => {
    const result = run(
      [
        home(`<a href="tel:+15551234567">(555) 123-4567</a><a href="/contact">Contact</a>
              <a href="https://calendly.com/smiledental">Book online</a>`),
        keyPage('contact', CONTACT_FORM),
      ],
      [link('/contact'), link('/about')]
    );
    expect(result.score).toBe(100);
    expect(result.checks.findings.map((f) => [f.id, f.status])).toEqual([
      ['lead.clickToCall', 'pass'],
      ['lead.form', 'pass'],
      ['lead.booking', 'pass'],
      ['lead.contactPage', 'pass'],
      ['lead.brokenLinks', 'pass'],
    ]);
    expect(finding(result, 'lead.form')?.label).toBe('Contact form on the contact page');
    expect(finding(result, 'lead.booking')?.detail).toBe('calendly.com');
    expect(finding(result, 'lead.brokenLinks')?.label).toBe('No broken links (2 checked)');
  });

  it('adds up partial points: phone elsewhere 10, email link 10, contact page 10, unchecked links 20', () => {
    const result = run(
      [home('<a href="mailto:office@smiledental.com">Email us</a><a href="/contact">Contact</a>'), keyPage('contact', '<a href="tel:5551234567">Call</a>')],
      [link('/a', 'unknown')]
    );
    expect(result.score).toBe(50);
    expect(finding(result, 'lead.clickToCall')).toMatchObject({ status: 'warn', detail: 'Only on the contact page' });
    expect(finding(result, 'lead.form')).toMatchObject({ status: 'warn', label: 'Only an email link — no contact form found' });
    expect(finding(result, 'lead.booking')?.status).toBe('warn');
    expect(finding(result, 'lead.brokenLinks')).toMatchObject({ status: 'warn', label: "Couldn't check the site's links" });
  });

  it('gives 0 to a page with no way to reach the business and a broken link', () => {
    const result = run([home('<p>Welcome</p>')], [link('/old', 'broken')]);
    expect(result.score).toBe(0);
    expect(finding(result, 'lead.form')?.label).toBe('No contact form or email link found on the pages we checked');
  });

  it('ignores tel: links too short to be a phone number', () => {
    const result = run([home('<a href="tel:">Call</a><a href="tel:911">Emergency</a>')]);
    // Phones make plain-text numbers tappable, so the claim is only about links, on the pages read
    expect(finding(result, 'lead.clickToCall')).toMatchObject({ status: 'fail', label: 'No tap-to-call phone link on the pages we checked' });
  });

  it("never claims there's no contact form when the contact page couldn't be read", () => {
    const unread = keyPage('contact', null);
    const withEmail = run([home('<a href="mailto:office@smiledental.com">Email</a><a href="/contact">Contact</a>'), unread], [link('/contact', 'unknown')]);
    expect(finding(withEmail, 'lead.formUnchecked')).toMatchObject({ status: 'warn', label: "Couldn't check the contact page for a form" });
    expect(finding(withEmail, 'lead.form')).toBeUndefined();
    const without = run([home('<a href="/contact">Contact</a>'), unread], [link('/contact', 'unknown')]);
    expect(without.score).toBe(60); // form 30 kept + contact page 10 + links 20
  });

  it('still reports no contact form when the contact page is missing (404)', () => {
    const result = run([home('<a href="/contact">Contact</a>'), keyPage('contact', null)], [link('/contact', 'broken')]);
    expect(finding(result, 'lead.form')?.status).toBe('fail');
  });

  it('reads a key page against the address it redirected to', () => {
    // /booking redirected to the business's Vagaro page, whose links are Vagaro's own
    const booking: LeadPage = {
      url: `${SITE}/booking`,
      finalUrl: 'https://www.vagaro.com/smiledental',
      kind: 'booking',
      html: '<a href="/pro/pricing">Pricing</a>',
    };
    expect(finding(run([home('<a href="/booking">Appointments</a>'), booking]), 'lead.booking')).toMatchObject({
      status: 'pass',
      detail: 'vagaro.com',
    });
  });

  it.each([
    ['a Cloudflare-protected email link', '<a href="/cdn-cgi/l/email-protection#1a2b3c">[email&#160;protected]</a>'],
    ['a Cloudflare-protected email address', '<span class="__cf_email__" data-cfemail="1a2b3c">[email&#160;protected]</span>'],
  ])('counts %s as an email link', (_name, html) => {
    expect(finding(run([home(html)]), 'lead.form')?.status).toBe('warn');
  });

  it.each([
    ['Mailchimp for WordPress', '<form class="mc4wp-form"><input name="FNAME"><input type="email" name="EMAIL"></form>'],
    ['MailPoet', '<form action="/wp-admin/admin-post.php?action=mailpoet_subscription_form"><input name="first"><input type="email" name="email"></form>'],
    ['Klaviyo', '<form class="klaviyo-form-XyZ12"><input name="first_name"><input type="email" name="email"></form>'],
    ['a shop cart', '<form class="cart"><select name="attribute_size"><option>M</option></select><input type="number" name="quantity"></form>'],
    ['a form with a Subscribe button', '<form><input name="name"><input type="email" name="email"><button>Subscribe</button></form>'],
  ])("doesn't count %s as a contact form", (_name, html) => {
    expect(finding(run([home(html)]), 'lead.form')?.status).toBe('fail');
  });

  it.each([
    ['a GoHighLevel form', '<iframe src="https://api.leadconnectorhq.com/widget/form/AbC123"></iframe>'],
    ['a lazy-loaded Jotform', '<iframe src="about:blank" data-lazy-src="https://form.jotform.com/231234567890"></iframe>'],
    ['a Ninja Forms block', '<div class="nf-form-cont"></div>'],
  ])('counts %s as a contact form', (_name, html) => {
    expect(finding(run([home(html)]), 'lead.form')?.status).toBe('pass');
  });

  it('says it could not check an unknown embedded widget on the contact page, but ignores maps', () => {
    const contactWith = (html: string) => run([home('<a href="/contact">Contact</a>'), keyPage('contact', html)]);
    expect(finding(contactWith('<iframe src="https://widgets.formbuilder.example/f/1"></iframe>'), 'lead.formUnchecked')).toMatchObject({
      status: 'warn',
      label: "Couldn't read the embedded widget on the contact page — it may be a form",
    });
    expect(finding(contactWith('<iframe src="https://www.google.com/maps/embed?pb=abc"></iframe>'), 'lead.form')?.status).toBe('fail');
  });

  it("doesn't count search boxes, newsletter sign-ups or logins as contact forms", () => {
    const result = run([
      home(`
        <form role="search"><input name="s"></form>
        <form action="/search"><input name="q"><select name="in"><option>All</option></select></form>
        <form class="newsletter-form"><input name="fname"><input type="email" name="email"></form>
        <form id="login"><input name="user"><input type="password" name="pass"></form>
        <form><input type="email" name="email"></form>`),
    ]);
    expect(finding(result, 'lead.form')?.status).toBe('fail');
  });

  it('counts a form of several fields without a message box', () => {
    const result = run([home('<form><input name="name"><input type="tel" name="phone"><input type="hidden" name="t"></form>')]);
    expect(finding(result, 'lead.form')).toMatchObject({ status: 'pass', label: 'Contact form on the homepage' });
  });

  it.each([
    ['a Jotform embed', '<iframe src="https://form.jotform.com/231234567890"></iframe>'],
    ['a HubSpot form script', '<script src="//js.hsforms.net/forms/embed/v2.js"></script>'],
    ['a Google Form link', '<a href="https://docs.google.com/forms/d/e/abc/viewform">Enquire</a>'],
    ['a Squarespace form block', '<div class="sqs-block website-component-block sqs-block-form form-block"></div>'],
  ])('counts %s as a contact form', (_name, html) => {
    expect(finding(run([home(html)]), 'lead.form')?.status).toBe('pass');
  });

  it.each([
    ['a Zocdoc widget', '<iframe src="https://www.zocdoc.com/widget/abc"></iframe>', 'zocdoc.com'],
    ['Square Appointments', '<a href="https://squareup.com/appointments/book/abc/start">Book</a>', 'squareup.com'],
    ['a booking link on the site', '<a href="/request-appointment">Request an appointment</a>', '/request-appointment'],
  ])('finds %s as online booking', (_name, html, detail) => {
    expect(finding(run([home(html)]), 'lead.booking')).toMatchObject({ status: 'pass', detail });
  });

  it('only warns when there is no online booking — a Facebook link is not one', () => {
    const result = run([home('<a href="https://facebook.com/smiledental">Facebook</a>')]);
    expect(finding(result, 'lead.booking')).toMatchObject({ status: 'warn', label: 'No online booking — visitors can only call or email' });
  });

  it('passes the contact page check for a linked contact page, even one that failed to load', () => {
    const result = run([home('<a href="/contact">Contact</a>'), keyPage('contact', null)]);
    expect(finding(result, 'lead.contactPage')).toMatchObject({ status: 'pass', label: 'Contact page linked from the homepage' });
  });

  it('passes the contact page check for a form right on the homepage', () => {
    const result = run([home(CONTACT_FORM)]);
    expect(finding(result, 'lead.contactPage')).toMatchObject({ status: 'pass', label: 'Contact form right on the homepage' });
  });

  it('fails the contact page check when there is neither', () => {
    expect(finding(run([home('<p>Hi</p>')]), 'lead.contactPage')?.status).toBe('fail');
  });

  it('lists up to 3 broken links', () => {
    const result = run([home('')], ['/a', '/b', '/c?x=1', '/d'].map((p) => link(p, 'broken')).concat(link('/ok')));
    expect(finding(result, 'lead.brokenLinks')).toMatchObject({
      status: 'fail',
      label: '4 broken links — visitors land on a "page not found"',
      detail: '/a, /b, /c?x=1',
    });
    expect(result.checks.links).toEqual({
      checked: 5,
      broken: ['/a', '/b', '/c?x=1', '/d'].map((p) => `${SITE}${p}`),
    });
  });

  it('mentions WhatsApp only when the site links to it', () => {
    expect(finding(run([home('<a href="https://wa.me/15551234567">WhatsApp</a>')]), 'lead.whatsapp')?.status).toBe('pass');
    expect(finding(run([home('<p>Hi</p>')]), 'lead.whatsapp')).toBeUndefined();
  });

  it('records which pages were read', () => {
    const result = run([home('<p>Hi</p>'), keyPage('contact', null), keyPage('about', '<p>About</p>')]);
    expect(result.checks.pages).toEqual([
      { url: `${SITE}/`, kind: 'home', ok: true },
      { url: `${SITE}/contact`, kind: 'contact', ok: false },
      { url: `${SITE}/about`, kind: 'about', ok: true },
    ]);
  });
});
