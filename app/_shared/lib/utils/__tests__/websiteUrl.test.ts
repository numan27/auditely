import { describe, it, expect } from 'vitest';
import { normalizeWebsiteUrl, websiteKey } from '@/app/_shared/lib/utils/websiteUrl';

const ok = (input: string) => {
  const result = normalizeWebsiteUrl(input);
  if (!result.ok) throw new Error(`expected ${input} to pass: ${result.error}`);
  return result;
};

describe('normalizeWebsiteUrl', () => {
  it('adds https:// to a bare domain', () => {
    expect(ok('washdent.com')).toEqual({ ok: true, url: 'https://washdent.com', host: 'washdent.com' });
  });

  it('keeps http, lowercases the host and drops www. from the display host', () => {
    expect(ok('  http://WWW.Washdent.com/  ')).toEqual({ ok: true, url: 'http://www.washdent.com', host: 'washdent.com' });
  });

  it('keeps a path but drops the query and fragment', () => {
    expect(ok('https://example.co.uk/services/?utm=x#top').url).toBe('https://example.co.uk/services');
  });

  it.each([
    ['empty', '   '],
    ['not a domain', 'hello'],
    ['localhost', 'http://localhost:3000'],
    ['an IPv4 address', '127.0.0.1'],
    ['a cloud metadata IP', 'http://169.254.169.254/latest'],
    ['an IPv6 address', 'http://[::1]/'],
    ['an internal name', 'https://intranet.corp'],
    ['a custom port', 'https://example.com:8080'],
    ['credentials', 'https://user:pass@example.com'],
    ['another scheme', 'ftp://example.com'],
  ])('refuses %s', (_, input) => {
    expect(normalizeWebsiteUrl(input).ok).toBe(false);
  });
});

describe('websiteKey', () => {
  it('matches the same site across scheme, www. and trailing slash', () => {
    expect(websiteKey('http://www.washdent.com/')).toBe(websiteKey('https://washdent.com'));
  });

  it('tells different paths apart', () => {
    expect(websiteKey('https://a.com/one')).not.toBe(websiteKey('https://a.com/two'));
  });
});
