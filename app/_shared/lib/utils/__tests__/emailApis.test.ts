import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const paths = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.map(([url]) => new URL(url as string).pathname);
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

  it('never calls Snov in the automatic pass, even when configured', async () => {
    fetchMock.mockResolvedValue(json({ data: { total: 0 } }));
    await lookupEmailViaApis('smiledental.com', 'auto');
    expect(calledSnov(fetchMock)).toBe(false);
  });

  it('falls through to Snov when looking up manually', async () => {
    // Hunter has nothing; Snov returns no token and gives up
    fetchMock.mockImplementation(async (url: string) => (url.includes('hunter.io') ? json({ data: { total: 0 } }) : json({})));
    expect(await lookupEmailViaApis('smiledental.com', 'all')).toBeNull();
    expect(calledSnov(fetchMock)).toBe(true);
  });
});
