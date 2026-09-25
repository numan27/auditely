import { describe, it, expect } from 'vitest';
import { extractContactChannels } from '@/app/_shared/lib/utils/contactChannels';

const PAGE = 'https://www.smiledental.com/';

describe('extractContactChannels', () => {
  it('finds social profiles and normalizes their URLs', () => {
    const html = `
      <a href="https://m.facebook.com/SmileDentalLV/?ref=footer">fb</a>
      <a href="http://instagram.com/smiledental_lv/">ig</a>
      <a href="https://www.linkedin.com/company/smile-dental/about/">li</a>`;
    expect(extractContactChannels(html, PAGE).socials).toEqual({
      facebook: 'https://www.facebook.com/SmileDentalLV',
      instagram: 'https://www.instagram.com/smiledental_lv',
      linkedin: 'https://www.linkedin.com/company/smile-dental',
    });
  });

  it('ignores share buttons, pixels, single posts and site-builder accounts', () => {
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
      <a href="https://www.facebook.com/tr?id=1">pixel</a>
      <a href="https://www.instagram.com/p/Cx123/">post</a>
      <a href="https://www.facebook.com/wix">builder</a>
      <a href="https://www.linkedin.com/shareArticle?url=x">share</a>`;
    expect(extractContactChannels(html, PAGE).socials).toEqual({});
  });

  it('keeps the id of facebook profile.php pages', () => {
    const html = '<a href="https://www.facebook.com/profile.php?id=100063&ref=x">fb</a>';
    expect(extractContactChannels(html, PAGE).socials.facebook).toBe('https://www.facebook.com/profile.php?id=100063');
  });

  it('falls back to schema.org sameAs and telephone', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Dentist',
      name: 'Smile Dental',
      telephone: '+1 702-555-0100',
      sameAs: ['https://www.instagram.com/smiledental'],
    })}</script>`;
    expect(extractContactChannels(html, PAGE)).toMatchObject({
      phone: '(702) 555-0100',
      socials: { instagram: 'https://www.instagram.com/smiledental' },
    });
  });

  it('prefers a tap-to-call link for the phone', () => {
    const html = '<a href="tel:+17028881113">Call us</a>';
    expect(extractContactChannels(html, PAGE).phone).toBe('(702) 888-1113');
  });

  it('finds the contact page on the same site only', () => {
    const html = `
      <a href="https://partner.com/contact">partner</a>
      <a href="mailto:hi@smiledental.com">Contact</a>
      <a href="/get-in-touch#form">Contact Us</a>`;
    expect(extractContactChannels(html, PAGE).contactPage).toBe('https://www.smiledental.com/get-in-touch');
  });

  it('returns empty channels for a page without any', () => {
    expect(extractContactChannels('<p>Welcome</p>', PAGE)).toEqual({ phone: null, contactPage: null, socials: {} });
  });
});
