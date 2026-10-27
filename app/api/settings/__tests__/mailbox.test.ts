import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));
// Logging in to a real mail server is mailbox.test.ts's job
vi.mock('@/app/_shared/lib/email/mailbox', () => ({ verifyMailbox: vi.fn() }));
// Encryption and the table are userSecrets.test.ts's
vi.mock('@/app/_shared/lib/secrets/userSecrets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/secrets/userSecrets')>()),
  saveSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

const { PUT, DELETE } = await import('@/app/api/settings/mailbox/route');
const { verifyMailbox } = await import('@/app/_shared/lib/email/mailbox');
const { SettingsNotMigrated, deleteSecret, saveSecret } = await import('@/app/_shared/lib/secrets/userSecrets');
const { featureMessage } = await import('@/app/_shared/lib/usage/usageCopy');

const GMAIL = { host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass' };
let accounts = 0;
// A tester on Pro, under a fresh id so each test has the hour's tries to itself
const signInPaid = () => {
  const id = `u${++accounts}`;
  vi.stubEnv('PLAN_OVERRIDES', 'sam@acme.studio:pro');
  session.current = { db: {}, account: { id, email: 'sam@acme.studio', isOwner: false } };
  return id;
};
const signInFree = () => {
  session.current = { db: {}, account: { id: `free${++accounts}`, email: 'free@x.com', isOwner: false } };
};
const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/settings/mailbox', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const del = () => DELETE();
const answer = async (res: Response) => ({ status: res.status, json: await res.json() });

beforeEach(() => {
  vi.stubEnv('SECRETS_KEY', randomBytes(32).toString('base64'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(verifyMailbox).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(saveSecret).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteSecret).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PUT /api/settings/mailbox', () => {
  it('connects a paid account’s mailbox after checking it, and never answers with the password', async () => {
    const id = signInPaid();
    const res = await put(GMAIL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mailbox: 'sam@acme.studio' });
    expect(JSON.stringify(body)).not.toContain('app-pass');
    const mailbox = { ...GMAIL, fromEmail: 'sam@acme.studio' };
    expect(verifyMailbox).toHaveBeenCalledWith(mailbox);
    expect(saveSecret).toHaveBeenCalledWith(id, 'smtp', mailbox, 'sam@acme.studio');
  });

  it('keeps it from Free accounts', async () => {
    signInFree();
    expect(await answer(await put(GMAIL))).toEqual({ status: 403, json: { error: featureMessage('mailbox') } });
    expect(verifyMailbox).not.toHaveBeenCalled();
    expect(saveSecret).not.toHaveBeenCalled();
  });

  it('stops after 10 tries in an hour', async () => {
    signInPaid();
    for (let i = 0; i < 10; i++) expect((await put(GMAIL)).status).toBe(200);
    expect(await answer(await put(GMAIL))).toEqual({ status: 429, json: { error: "You've tried 10 times this hour. Try again later." } });
    expect(verifyMailbox).toHaveBeenCalledTimes(10);
  });

  it('says what to fix in the form, without trying to log in', async () => {
    signInPaid();
    expect(await answer(await put({ ...GMAIL, port: 25 }))).toEqual({ status: 400, json: { error: 'The port must be 465 or 587.' } });
    expect(await answer(await put('not json'))).toEqual({ status: 400, json: { error: "Enter your mail provider's SMTP server, like smtp.gmail.com." } });
    expect(verifyMailbox).not.toHaveBeenCalled();
  });

  it('saves nothing the mail server refused', async () => {
    signInPaid();
    vi.mocked(verifyMailbox).mockResolvedValue({ ok: false, error: 'The mailbox refused the login. Check the email address and app password.' });
    expect(await answer(await put(GMAIL))).toEqual({
      status: 400,
      json: { error: 'The mailbox refused the login. Check the email address and app password.' },
    });
    expect(saveSecret).not.toHaveBeenCalled();
  });

  it('says SECRETS_KEY is missing before logging in to anything', async () => {
    signInPaid();
    vi.stubEnv('SECRETS_KEY', '');
    expect(await answer(await put(GMAIL))).toEqual({ status: 503, json: { error: "Saving connections isn't set up: add SECRETS_KEY in Vercel." } });
    expect(verifyMailbox).not.toHaveBeenCalled();
  });

  it('says the database needs the settings migration', async () => {
    signInPaid();
    vi.mocked(saveSecret).mockRejectedValue(new SettingsNotMigrated());
    expect(await answer(await put(GMAIL))).toEqual({ status: 503, json: { error: "Settings can't be saved right now. Try again later." } });
  });

  it('never logs the password when saving fails', async () => {
    signInPaid();
    vi.mocked(saveSecret).mockRejectedValue(new Error('user_secrets: connection reset'));
    expect(await answer(await put(GMAIL))).toEqual({ status: 500, json: { error: "Your mailbox wasn't saved. Try again." } });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('app-pass');
  });
});

describe('DELETE /api/settings/mailbox', () => {
  it('forgets the saved mailbox, on any plan', async () => {
    const id = signInPaid();
    expect(await answer(await del())).toEqual({ status: 200, json: { mailbox: null } });
    expect(deleteSecret).toHaveBeenCalledWith(id, 'smtp');
    // An account that moved back to Free can still remove what it saved
    signInFree();
    expect((await del()).status).toBe(200);
  });

  it('says so when it could not be removed', async () => {
    signInPaid();
    vi.mocked(deleteSecret).mockRejectedValue(new Error('user_secrets: connection reset'));
    expect(await answer(await del())).toEqual({ status: 500, json: { error: "Your mailbox wasn't disconnected. Try again." } });
  });
});
