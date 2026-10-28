// What search engines are told: nothing while Auditely is invite-only; once
// sign-ups open, the public pages and none of the app behind the sign-in.

import { describe, it, expect, vi, afterEach } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { AUDITELY_URL } from '@/app/_shared/lib/config/site';

afterEach(() => vi.unstubAllEnvs());

describe('robots and the sitemap', () => {
  it('lets search engines in only once sign-ups are open', () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/demo'],
        disallow: ['/api/', '/auth/', '/report/', '/search', '/searches', '/audit', '/requests', '/plans', '/settings'],
      },
      sitemap: `${AUDITELY_URL}/sitemap.xml`,
    });

    vi.stubEnv('SIGNUPS_OPEN', '');
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('lists the public pages only once sign-ups are open', () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    expect(sitemap().map((entry) => entry.url)).toEqual([`${AUDITELY_URL}/`, `${AUDITELY_URL}/terms`, `${AUDITELY_URL}/privacy`]);
    vi.stubEnv('SIGNUPS_OPEN', '');
    expect(sitemap()).toEqual([]);
  });
});
