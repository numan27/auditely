// Auditely's own address: the domain once SITE_URL names it, the vercel.app
// address until then.

import { describe, it, expect } from 'vitest';
import { AUDITELY_URL, siteUrl } from '@/app/_shared/lib/config/site';

describe('siteUrl', () => {
  it('uses SITE_URL once the domain is set, and the vercel.app address until then', () => {
    expect(siteUrl({ SITE_URL: 'https://auditely.app' })).toBe('https://auditely.app');
    expect(siteUrl({ SITE_URL: ' https://auditely.app/ ' })).toBe('https://auditely.app');
    expect(siteUrl({})).toBe('https://auditely.vercel.app');
    expect(siteUrl({ SITE_URL: '' })).toBe('https://auditely.vercel.app');
    // Only a whole https address counts
    expect(siteUrl({ SITE_URL: 'http://x' })).toBe('https://auditely.vercel.app');
    expect(siteUrl({ SITE_URL: 'junk' })).toBe('https://auditely.vercel.app');
    expect(siteUrl({ SITE_URL: 'auditely.app' })).toBe('https://auditely.vercel.app');
    expect(AUDITELY_URL).toBe(siteUrl());
  });
});
