import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

describe('findEmail with prefetched homepage HTML', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('uses the given HTML instead of fetching the homepage', async () => {
    const email = await findEmail('https://smiledental.com/', {
      homepageHtml: '<a href="mailto:hello@smiledental.com">Email us</a>',
    });
    expect(email).toBe('hello@smiledental.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still scrapes the contact pages when the homepage has no email', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://smiledental.com/contact'
        ? new Response('<p>office@smiledental.com</p>', { status: 200 })
        : new Response('', { status: 404 })
    );
    const email = await findEmail('https://smiledental.com/', { homepageHtml: '<p>No email here</p>' });
    expect(email).toBe('office@smiledental.com');
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('https://smiledental.com/');
  });
});
