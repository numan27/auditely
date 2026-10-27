import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));
// Asking HubSpot is hubspot.test.ts's job
vi.mock('@/app/_shared/lib/crm/hubspot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/crm/hubspot')>()),
  checkHubSpotToken: vi.fn(),
}));
// Encryption and the table are userSecrets.test.ts's
vi.mock('@/app/_shared/lib/secrets/userSecrets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/secrets/userSecrets')>()),
  saveSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

const { PUT, DELETE } = await import('@/app/api/settings/hubspot/route');
const { checkHubSpotToken } = await import('@/app/_shared/lib/crm/hubspot');
const { SettingsNotMigrated, deleteSecret, saveSecret } = await import('@/app/_shared/lib/secrets/userSecrets');
const { featureMessage } = await import('@/app/_shared/lib/usage/usageCopy');

let accounts = 0;
// A tester on Pro, under a fresh id so each test has the hour's tries to itself
const signInPaid = () => {
  const id = `hs${++accounts}`;
  vi.stubEnv('PLAN_OVERRIDES', 'sam@acme.studio:pro');
  session.current = { db: {}, account: { id, email: 'sam@acme.studio', isOwner: false } };
  return id;
};
const signInFree = () => {
  session.current = { db: {}, account: { id: `hsfree${++accounts}`, email: 'free@x.com', isOwner: false } };
};
const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/settings/hubspot', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const answer = async (res: Response) => ({ status: res.status, json: await res.json() });
const PASTE = { status: 400, json: { error: 'Paste your HubSpot access token.' } };

beforeEach(() => {
  vi.stubEnv('SECRETS_KEY', randomBytes(32).toString('base64'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(checkHubSpotToken).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(saveSecret).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteSecret).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PUT /api/settings/hubspot', () => {
  it('connects a paid account’s token after HubSpot accepts it, and never answers with it', async () => {
    const id = signInPaid();
    const res = await put({ token: ' pat-na1-secret ' });
    expect([res.status, await res.json()]).toEqual([200, { hubspot: true }]);
    expect(checkHubSpotToken).toHaveBeenCalledWith('pat-na1-secret');
    expect(saveSecret).toHaveBeenCalledWith(id, 'hubspot', { token: 'pat-na1-secret' }, null);
  });

  it('keeps HubSpot from Free accounts', async () => {
    signInFree();
    expect(await answer(await put({ token: 'pat-na1-secret' }))).toEqual({ status: 403, json: { error: featureMessage('hubspot') } });
    expect(checkHubSpotToken).not.toHaveBeenCalled();
  });

  it('asks for a token before asking HubSpot', async () => {
    signInPaid();
    for (const body of [{ token: '  ' }, { token: 'p'.repeat(201) }, { token: 42 }, {}, 'not json']) {
      expect(await answer(await put(body))).toEqual(PASTE);
    }
    expect(checkHubSpotToken).not.toHaveBeenCalled();
  });

  it('saves nothing HubSpot refused', async () => {
    signInPaid();
    const refused = 'HubSpot refused the token. Check it has read and write access to companies and contacts.';
    vi.mocked(checkHubSpotToken).mockResolvedValue({ ok: false, error: refused });
    expect(await answer(await put({ token: 'pat-bad' }))).toEqual({ status: 400, json: { error: refused } });
    expect(saveSecret).not.toHaveBeenCalled();
  });

  it('stops after 10 tries in an hour', async () => {
    signInPaid();
    for (let i = 0; i < 10; i++) expect((await put({ token: 'pat-1' })).status).toBe(200);
    expect(await answer(await put({ token: 'pat-1' }))).toEqual({ status: 429, json: { error: "You've tried 10 times this hour. Try again later." } });
  });

  it('says SECRETS_KEY is missing before asking HubSpot', async () => {
    signInPaid();
    vi.stubEnv('SECRETS_KEY', '');
    expect(await answer(await put({ token: 'pat-1' }))).toEqual({ status: 503, json: { error: "Saving connections isn't set up: add SECRETS_KEY in Vercel." } });
    expect(checkHubSpotToken).not.toHaveBeenCalled();
  });

  it('says the database needs the settings migration, and never logs the token', async () => {
    signInPaid();
    vi.mocked(saveSecret).mockRejectedValue(new SettingsNotMigrated());
    expect(await answer(await put({ token: 'pat-na1-secret' }))).toEqual({ status: 503, json: { error: "Settings can't be saved right now. Try again later." } });
    vi.mocked(saveSecret).mockRejectedValue(new Error('user_secrets: connection reset'));
    expect(await answer(await put({ token: 'pat-na1-secret' }))).toEqual({ status: 500, json: { error: "Your HubSpot token wasn't saved. Try again." } });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('pat-na1-secret');
  });
});

describe('DELETE /api/settings/hubspot', () => {
  it('forgets the saved token, on any plan', async () => {
    const id = signInPaid();
    expect(await answer(await DELETE())).toEqual({ status: 200, json: { hubspot: false } });
    expect(deleteSecret).toHaveBeenCalledWith(id, 'hubspot');
    signInFree();
    expect((await DELETE()).status).toBe(200);
  });

  it('says so when it could not be removed', async () => {
    signInPaid();
    vi.mocked(deleteSecret).mockRejectedValue(new Error('user_secrets: connection reset'));
    expect(await answer(await DELETE())).toEqual({ status: 500, json: { error: "HubSpot wasn't disconnected. Try again." } });
  });
});
