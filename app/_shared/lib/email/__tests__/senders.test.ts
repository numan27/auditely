import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/secrets/userSecrets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/secrets/userSecrets')>()),
  readSecret: vi.fn(),
}));

const { mailboxFor } = await import('@/app/_shared/lib/email/senders');
const { readSecret, SettingsNotMigrated } = await import('@/app/_shared/lib/secrets/userSecrets');
const { SecretUnreadable, SecretsKeyMissing } = await import('@/app/_shared/lib/secrets/secrets');

const OWNER = { id: 'owner-1', email: 'owner@example.com', isOwner: true };
const SAM = { id: 'u2', email: 'sam@acme.studio', isOwner: false };
const SAVED = { host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass', fromEmail: 'sam@acme.studio' };

beforeEach(() => {
  vi.mocked(readSecret).mockReset().mockResolvedValue(null);
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
