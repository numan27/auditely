import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
// Hunter requests only (the automatic pass may go on to Snov)
const paths = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([url]) => url as string).filter((url) => url.includes('hunter.io')).map((url) => new URL(url).pathname);
const calledSnov = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.some(([url]) => (url as string).includes('snov.io'));

describe('lookupEmailViaApis', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('HUNTER_API_KEY', 'hunter-key');
    vi.stubEnv('SNOV_CLIENT_ID', 'snov-id');
    vi.stubEnv('SNOV_CLIENT_SECRET', 'snov-secret');
    vi.stubEnv('TOMBA_API_KEY', '');
    vi.stubEnv('APOLLO_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it("skips Hunter's paid search when its free count says it has no emails", async () => {
    fetchMock.mockResolvedValue(json({ data: { total: 0 } }));
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toEqual({ email: null, refused: false });
    expect(paths(fetchMock)).toEqual(['/v2/email-count']);
  });

  it('spends a Hunter search when Hunter has emails for the domain', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('email-count')
        ? json({ data: { total: 3 } })
        : json({ data: { emails: [{ value: 'Office@SmileDental.com' }] } })
    );
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toEqual({ email: 'office@smiledental.com', refused: false });
    expect(paths(fetchMock)).toEqual(['/v2/email-count', '/v2/domain-search']);
  });

  // Hunter has nothing; Snov answers per endpoint
  const snov = (count: number, emails: string[] = []) => async (url: string) => {
    if (url.includes('hunter.io')) return json({ data: { total: 0 } });
    if (url.includes('oauth/access_token')) return json({ access_token: 'tok' });
    if (url.includes('get-domain-emails-count')) return json({ success: true, result: count });
    if (url.includes('domain-emails/start')) return json({ meta: { task_hash: 'h1' } });
    if (url.includes('domain-emails/result')) return json({ status: 'completed', data: emails.map((email) => ({ email })) });
    throw new Error(`unexpected fetch ${url}`);
  };

  it("tries Snov in the automatic pass, skipping its paid search when its free count is 0", async () => {
    fetchMock.mockImplementation(snov(0));
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toEqual({ email: null, refused: false });
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls.some((url) => url.includes('get-domain-emails-count'))).toBe(true);
    expect(urls.some((url) => url.includes('domain-emails/start'))).toBe(false);
  });

  it("uses Snov when it has emails, preferring a general inbox over an employee", async () => {
    fetchMock.mockImplementation(snov(5, ['jane.doe@smiledental.com', 'hr@smiledental.com', 'info@smiledental.com']));
    expect((await lookupEmailViaApis('smiledental.com', 'auto')).email).toBe('info@smiledental.com');
  });

  it('falls back to the first usable Snov address when there is no general inbox', async () => {
    fetchMock.mockImplementation(snov(2, ['hr@smiledental.com', 'jane.doe@smiledental.com']));
    expect((await lookupEmailViaApis('smiledental.com', 'auto')).email).toBe('jane.doe@smiledental.com');
  });

  it('falls through to Snov when looking up manually', async () => {
    // Hunter has nothing; Snov returns no token and gives up
    fetchMock.mockImplementation(async (url: string) => (url.includes('hunter.io') ? json({ data: { total: 0 } }) : json({})));
    expect(await lookupEmailViaApis('smiledental.com', 'all')).toEqual({ email: null, refused: false });
    expect(calledSnov(fetchMock)).toBe(true);
  });

  describe('the paid-call gate', () => {
    const urls = () => fetchMock.mock.calls.map(([url]) => url as string);
    // Every provider answers; Hunter's count and Snov's count say how many they hold
    const providers = (hunterTotal: number, snovCount: number, snovEmails: string[] = []) => async (url: string) => {
      if (url.includes('hunter.io/v2/email-count')) return json({ data: { total: hunterTotal } });
      if (url.includes('hunter.io/v2/domain-search')) return json({ data: { emails: [] } });
      if (url.includes('tomba.io')) return json({ data: { emails: [] } });
      if (url.includes('apollo.io')) return json({ people: [] });
      return snov(snovCount, snovEmails)(url);
    };

    it('asks before the first paid request and stops when refused', async () => {
      vi.stubEnv('TOMBA_API_KEY', 'tomba-key');
      vi.stubEnv('TOMBA_SECRET', 'tomba-secret');
      vi.stubEnv('APOLLO_API_KEY', 'apollo-key');
      fetchMock.mockImplementation(providers(3, 3));
      const allow = vi.fn(async () => false);
      expect(await lookupEmailViaApis('acme.com', 'all', allow)).toEqual({ email: null, refused: true });
      expect(allow).toHaveBeenCalledTimes(1);
      expect(urls().some((u) => u.includes('hunter.io/v2/domain-search'))).toBe(false);
      expect(urls().some((u) => u.includes('tomba') || u.includes('apollo') || u.includes('snov'))).toBe(false);
    });

    it('never asks when only the free counts run', async () => {
      fetchMock.mockImplementation(providers(0, 0));
      const allow = vi.fn(async () => true);
      expect(await lookupEmailViaApis('acme.com', 'auto', allow)).toEqual({ email: null, refused: false });
      expect(allow).not.toHaveBeenCalled();
    });

    it('asks once however many providers it tries', async () => {
      vi.stubEnv('TOMBA_API_KEY', 'tomba-key');
      vi.stubEnv('TOMBA_SECRET', 'tomba-secret');
      fetchMock.mockImplementation(providers(2, 1, ['info@acme.com']));
      const allow = vi.fn(async () => true);
      expect(await lookupEmailViaApis('acme.com', 'all', allow)).toEqual({ email: 'info@acme.com', refused: false });
      expect(allow).toHaveBeenCalledTimes(1);
      expect(urls().some((u) => u.includes('hunter.io/v2/domain-search'))).toBe(true);
      expect(urls().some((u) => u.includes('tomba.io'))).toBe(true);
    });

    it('asks nothing of a provider without keys', async () => {
      vi.stubEnv('HUNTER_API_KEY', '');
      vi.stubEnv('SNOV_CLIENT_ID', '');
      const allow = vi.fn(async () => true);
      expect(await lookupEmailViaApis('acme.com', 'all', allow)).toEqual({ email: null, refused: false });
      expect(allow).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a gate that fails as a refusal', async () => {
      fetchMock.mockImplementation(providers(3, 0));
      const allow = vi.fn(async () => { throw new Error('network'); });
      expect(await lookupEmailViaApis('acme.com', 'auto', allow)).toEqual({ email: null, refused: true });
      expect(urls().some((u) => u.includes('hunter.io/v2/domain-search'))).toBe(false);
    });
  });
});
