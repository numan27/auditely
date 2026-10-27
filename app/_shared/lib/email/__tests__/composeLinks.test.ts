import { describe, it, expect } from 'vitest';
import { composeLinks } from '@/app/_shared/lib/email/composeLinks';

describe('composeLinks', () => {
  it('opens a filled-in draft in Gmail and Outlook, every value encoded', () => {
    const { gmail, outlook } = composeLinks('office@smile.com', { subject: 'Your site & you', body: 'Hi,\n\nLine two' });
    expect(gmail).toBe('https://mail.google.com/mail/?view=cm&fs=1&to=office%40smile.com&su=Your%20site%20%26%20you&body=Hi%2C%0A%0ALine%20two');
    expect(outlook).toBe('https://outlook.office.com/mail/deeplink/compose?to=office%40smile.com&subject=Your%20site%20%26%20you&body=Hi%2C%0A%0ALine%20two');
  });

  it('keeps an address or subject from adding parameters of its own', () => {
    const { gmail } = composeLinks('a@b.com&cc=x@y.com', { subject: 'Hi?bcc=z@y.com', body: '#1' });
    expect(gmail).not.toContain('&cc=');
    expect(gmail).not.toContain('?bcc=');
    expect(new URL(gmail).searchParams.get('to')).toBe('a@b.com&cc=x@y.com');
    expect(new URL(gmail).searchParams.get('body')).toBe('#1');
  });
});
