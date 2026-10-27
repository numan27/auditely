import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/secrets/userSecrets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/secrets/userSecrets')>()),
  readSecret: vi.fn(),
}));

const { hubspotTokenFor, mailboxFor } = await import('@/app/_shared/lib/email/senders');
const { readSecret, SettingsNotMigrated } = await import('@/app/_shared/lib/secrets/userSecrets');
const { SecretUnreadable, SecretsKeyMissing } = await import('@/app/_shared/lib/secrets/secrets');

const OWNER = { id: 'owner-1', email: 'owner@example.com', isOwner: true };
const SAM = { id: 'u2', email: 'sam@acme.studio', isOwner: false };
const SAVED = { host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass', fromEmail: 'sam@acme.studio' };

beforeEach(() => {
  vi.mocked(readSecret).mockReset().mockResolvedValue(null);
  vi.stubEnv('HUBSPOT_TOKEN', 'env-token');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mailboxFor', () => {
  it('uses the saved mailbox, the owner’s included', async () => {
    vi.mocked(readSecret).mockResolvedValue(SAVED);
    expect(await mailboxFor(SAM)).toEqual({ ok: true, mailbox: SAVED });
    expect(readSecret).toHaveBeenCalledWith('u2', 'smtp');
    expect(await mailboxFor(OWNER)).toEqual({ ok: true, mailbox: SAVED });
  });

  it('sends the owner’s email through the Vercel mailbox when nothing is saved', async () => {
    expect(await mailboxFor(OWNER)).toEqual({ ok: true, mailbox: 'env' });
  });

  it('asks anyone else to connect a mailbox', async () => {
    expect(await mailboxFor(SAM)).toEqual({ ok: false, status: 400, error: 'Connect your mailbox in Settings to send from Auditely.' });
  });

  it('says what to do when the saved mailbox can’t be used', async () => {
    vi.mocked(readSecret).mockRejectedValue(new SecretUnreadable());
    expect(await mailboxFor(SAM)).toEqual({ ok: false, status: 400, error: "Your saved mailbox can't be read any more. Connect it again in Settings." });
    vi.mocked(readSecret).mockRejectedValue(new SecretsKeyMissing());
    expect(await mailboxFor(SAM)).toEqual({ ok: false, status: 503, error: "Saving connections isn't set up: add SECRETS_KEY in Vercel." });
  });

  it('keeps the owner sending before the settings migration', async () => {
    vi.mocked(readSecret).mockRejectedValue(new SettingsNotMigrated());
    expect(await mailboxFor(OWNER)).toEqual({ ok: true, mailbox: 'env' });
    expect(await mailboxFor(SAM)).toEqual({ ok: false, status: 503, error: "Settings can't be saved right now. Try again later." });
  });
});

describe('hubspotTokenFor', () => {
  it('uses the saved token, the owner’s included', async () => {
    vi.mocked(readSecret).mockResolvedValue({ token: 'pat-na1-secret' });
    expect(await hubspotTokenFor(SAM)).toEqual({ ok: true, token: 'pat-na1-secret' });
    expect(readSecret).toHaveBeenCalledWith('u2', 'hubspot');
    expect(await hubspotTokenFor(OWNER)).toEqual({ ok: true, token: 'pat-na1-secret' });
  });

  it('uses HUBSPOT_TOKEN for the owner when nothing is saved, and only for the owner', async () => {
    expect(await hubspotTokenFor(OWNER)).toEqual({ ok: true, token: 'env-token' });
    const connect = { ok: false, status: 400, error: 'Connect HubSpot in Settings to send leads.' };
    expect(await hubspotTokenFor(SAM)).toEqual(connect);
    vi.stubEnv('HUBSPOT_TOKEN', '');
    expect(await hubspotTokenFor(OWNER)).toEqual(connect);
  });

  it('says what to do when the saved token can’t be used', async () => {
    vi.mocked(readSecret).mockRejectedValue(new SecretUnreadable());
    expect(await hubspotTokenFor(SAM)).toEqual({
      ok: false,
      status: 400,
      error: "Your saved HubSpot token can't be read any more. Connect it again in Settings.",
    });
    vi.mocked(readSecret).mockRejectedValue(new SecretsKeyMissing());
    expect(await hubspotTokenFor(SAM)).toEqual({ ok: false, status: 503, error: "Saving connections isn't set up: add SECRETS_KEY in Vercel." });
  });

  it('keeps the owner on HUBSPOT_TOKEN before the settings migration', async () => {
    vi.mocked(readSecret).mockRejectedValue(new SettingsNotMigrated());
    expect(await hubspotTokenFor(OWNER)).toEqual({ ok: true, token: 'env-token' });
    expect(await hubspotTokenFor(SAM)).toEqual({ ok: false, status: 503, error: "Settings can't be saved right now. Try again later." });
  });
});
