import { describe, expect, it } from 'vitest';
import { privateAddress, withPrivateAddress } from '@/app/_shared/lib/analytics/pageAddress';

const SITE = 'https://auditely.vercel.app';
const ID = '3f2b8c1e-6d4a-4b7e-9a51-0c2d7e8f9a10';

describe('privateAddress', () => {
  it('counts a report link without the token that opens it', () => {
    expect(privateAddress(`${SITE}/report/k9Qz1xYp7Lm2?download=1#scores`)).toBe(`${SITE}/report/[token]`);
  });

  it("counts a search or an audit request without the account's own ids", () => {
    expect(privateAddress(`${SITE}/search/${ID}`)).toBe(`${SITE}/search/[id]`);
    expect(privateAddress(`${SITE}/requests/${ID}`)).toBe(`${SITE}/requests/[id]`);
  });

  it('keeps the campaign tags that say where a visitor came from, and drops the rest of the query', () => {
    expect(privateAddress(`${SITE}/?utm_source=reddit&load=${ID}&utm_campaign=launch`)).toBe(
      `${SITE}/?utm_source=reddit&utm_campaign=launch`
    );
    expect(privateAddress(`${SITE}/?ref=producthunt`)).toBe(`${SITE}/?ref=producthunt`);
    expect(privateAddress(`${SITE}/login?callbackUrl=%2Fsearch%2F${ID}`)).toBe(`${SITE}/login`);
  });

  it('leaves public pages as they are', () => {
    for (const path of ['/', '/demo', '/demo/report/sample-audit-1', '/plans', '/searches', '/privacy']) {
      expect(privateAddress(`${SITE}${path}`), path).toBe(`${SITE}${path}`);
    }
  });

  it("returns null for an address it can't read, so nothing is sent", () => {
    expect(privateAddress('not a url')).toBeNull();
  });
});

describe('withPrivateAddress', () => {
  it('sends the event with its address cleaned, or not at all', () => {
    expect(withPrivateAddress({ type: 'pageview', url: `${SITE}/report/abc` })).toEqual({ type: 'pageview', url: `${SITE}/report/[token]` });
    expect(withPrivateAddress({ type: 'pageview', url: '::' })).toBeNull();
  });
});
