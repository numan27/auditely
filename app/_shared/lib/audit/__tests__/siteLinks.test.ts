import { describe, it, expect } from 'vitest';
import { pickKeyPages, sameSiteLinks } from '@/app/_shared/lib/audit/siteLinks';

describe('sameSiteLinks', () => {
  it("keeps the site's own page links with their text, once each", () => {
    const html = `
      <a href="/contact">Contact <b>us</b></a>
      <a href="https://www.smiledental.com/contact/">Contact again</a>
      <a href="services#implants">Implants</a>
      <a href="//smiledental.com/about">About</a>
      <a href="https://facebook.com/smiledental">Facebook</a>
      <a href="mailto:hi@smiledental.com">Email</a>
      <a href="tel:5551234567">Call</a>
      <a href="#top">Top</a>
      <a href="/brochure.pdf">Brochure</a>
      <a href="/wp-json/">API</a>`;
    expect(sameSiteLinks(html, 'https://smiledental.com/')).toEqual([
      { url: 'https://smiledental.com/contact', text: 'Contact us' },
      { url: 'https://smiledental.com/services', text: 'Implants' },
      { url: 'https://smiledental.com/about', text: 'About' },
    ]);
  });
});

describe('pickKeyPages', () => {
  const home = 'https://smiledental.com/';

  it('picks the first contact, booking, services and about page, by address or link text', () => {
    const html = `
      <a href="/">Home</a>
      <a href="/our-team">Meet the team</a>
      <a href="/dental-services">Services</a>
      <a href="/request">Request an Appointment</a>
      <a href="/about-us">About</a>
      <a href="/get-in-touch">Get in touch</a>
      <a href="/contact">Contact</a>
      <a href="/services/implants">Implants</a>`;
    expect(pickKeyPages(html, home)).toEqual([
      { url: 'https://smiledental.com/get-in-touch', kind: 'contact' },
      { url: 'https://smiledental.com/request', kind: 'booking' },
      { url: 'https://smiledental.com/dental-services', kind: 'services' },
      { url: 'https://smiledental.com/about-us', kind: 'about' },
    ]);
  });

  it("doesn't take a Facebook link for booking, or the homepage for a key page", () => {
    const html =
      '<a href="https://smiledental.com">Home</a><a href="/facebook-reviews">Facebook reviews</a><a href="/book-online">Book online</a>';
    expect(pickKeyPages(html, home)).toEqual([{ url: 'https://smiledental.com/book-online', kind: 'booking' }]);
  });

  it('resolves links against the address the homepage redirected to', () => {
    const html = '<a href="contact">Contact</a><a href="https://smiledental.com/about">About</a>';
    expect(pickKeyPages(html, 'https://www.smiledental.com/home')).toEqual([
      { url: 'https://www.smiledental.com/contact', kind: 'contact' },
      { url: 'https://smiledental.com/about', kind: 'about' },
    ]);
  });

  it('prefers the real contact page over "Contact Lenses", and never takes Bookkeeping for booking', () => {
    const html = `
      <a href="/services/contact-lenses">Contact Lenses</a>
      <a href="/services/bookkeeping">Bookkeeping</a>
      <a href="/contact-us">Contact Us</a>`;
    expect(pickKeyPages(html, home)).toEqual([
      { url: 'https://smiledental.com/contact-us', kind: 'contact' },
      { url: 'https://smiledental.com/services/contact-lenses', kind: 'services' },
    ]);
  });

  it('takes an exact "Contact" link over an earlier one that only mentions contact', () => {
    const html = '<a href="/contact-our-billing-team">Billing questions</a><a href="/contact">Contact</a>';
    expect(pickKeyPages(html, home)[0]).toEqual({ url: 'https://smiledental.com/contact', kind: 'contact' });
  });

  it.each([['Visit Us', '/visit-us'], ['Enquire', '/enquire'], ['Inquiries', '/inquiries']])(
    'finds a contact page called "%s"',
    (text, path) => {
      expect(pickKeyPages(`<a href="${path}">${text}</a>`, home)).toEqual([{ url: `https://smiledental.com${path}`, kind: 'contact' }]);
    }
  );

  it('returns nothing when the homepage links to no key page', () => {
    expect(pickKeyPages('<p>Welcome</p>', home)).toEqual([]);
  });
});
