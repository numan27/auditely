import { describe, it, expect } from 'vitest';
import { PLAIN_OPT_OUT, plainOutreachHtml, plainOutreachText } from '@/app/_shared/lib/email/plainEmail';

const brand = {
  name: 'DevArtVentures',
  website: 'https://devartventures.com',
  contact: { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: 'https://cal.com/x' },
};
const body = 'Hi,\n\nYour site takes 6 s on phones.\nWant the report?\n\nNuman, DevArtVentures';

describe('plain outreach email', () => {
  it('is the message, a short footer and the opt-out, as text', () => {
    expect(plainOutreachText({ body, brand })).toBe(
      `${body}\n\ndevartventures.com · contact@devartventures.com\n\n${PLAIN_OPT_OUT}`
    );
  });

  it('has no logo, image, button or booking link in its HTML', () => {
    const html = plainOutreachHtml({ body, brand });
    expect(html).toContain('<p style="margin:0 0 14px;">Your site takes 6 s on phones.<br>Want the report?</p>');
    expect(html).not.toMatch(/<img|<table|cal\.com/);
    expect(html).toContain(PLAIN_OPT_OUT);
  });

  it('escapes what the sender typed', () => {
    expect(plainOutreachHtml({ body: '<b>Hi</b> & bye', brand })).toContain('&lt;b&gt;Hi&lt;/b&gt; &amp; bye');
  });
});
