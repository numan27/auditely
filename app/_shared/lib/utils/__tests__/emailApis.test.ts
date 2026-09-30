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
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toBeNull();
    expect(paths(fetchMock)).toEqual(['/v2/email-count']);
  });

  it('spends a Hunter search when Hunter has emails for the domain', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('email-count')
        ? json({ data: { total: 3 } })
        : json({ data: { emails: [{ value: 'Office@SmileDental.com' }] } })
    );
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toBe('office@smiledental.com');
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
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toBeNull();
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls.some((url) => url.includes('get-domain-emails-count'))).toBe(true);
    expect(urls.some((url) => url.includes('domain-emails/start'))).toBe(false);
  });

  it("uses Snov when it has emails, preferring a general inbox over an employee", async () => {
    fetchMock.mockImplementation(snov(5, ['jane.doe@smiledental.com', 'hr@smiledental.com', 'info@smiledental.com']));
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toBe('info@smiledental.com');
  });

  it('falls back to the first usable Snov address when there is no general inbox', async () => {
    fetchMock.mockImplementation(snov(2, ['hr@smiledental.com', 'jane.doe@smiledental.com']));
    expect(await lookupEmailViaApis('smiledental.com', 'auto')).toBe('jane.doe@smiledental.com');
  });

  it('falls through to Snov when looking up manually', async () => {
    // Hunter has nothing; Snov returns no token and gives up
    fetchMock.mockImplementation(async (url: string) => (url.includes('hunter.io') ? json({ data: { total: 0 } }) : json({})));
    expect(await lookupEmailViaApis('smiledental.com', 'all')).toBeNull();
    expect(calledSnov(fetchMock)).toBe(true);
  });
});
