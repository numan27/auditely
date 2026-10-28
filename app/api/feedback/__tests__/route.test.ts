import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({ session: null as unknown, send: vi.fn() }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => fake.session,
}));
vi.mock('@/app/_shared/lib/email/mailer', () => ({ sendEmail: fake.send }));

const { POST } = await import('@/app/api/feedback/route');

let accounts = 0;
/** A new account each time, so the hourly limit of one test doesn't reach the next */
const signIn = (email = 'tester@example.com') => {
  accounts += 1;
  fake.session = { db: {}, account: { id: `u${accounts}`, email, isOwner: false, subscription: null } };
};
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/feedback', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'owner@auditely.app');
  vi.stubEnv('PLAN_OVERRIDES', '');
  fake.send.mockReset().mockResolvedValue({ ok: true });
  signIn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/feedback', () => {
  it('emails the owner the message, who sent it, their plan and the page', async () => {
    const res = await post({ message: 'The PDF button did nothing.', page: '/search' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [email, mailbox] = fake.send.mock.calls[0];
    expect(mailbox).toBeUndefined();
    expect(email).toMatchObject({ to: 'owner@auditely.app', replyTo: 'tester@example.com', subject: 'Auditely feedback from tester@example.com' });
    expect(email.text).toContain('The PDF button did nothing.');
    expect(email.text).toContain('Plan: Free');
    expect(email.text).toContain('Page: /search');
  });

  it("names a tester's granted plan", async () => {
    vi.stubEnv('PLAN_OVERRIDES', 'tester@example.com:agency');
    await post({ message: 'More please', page: '/plans' });
    expect(fake.send.mock.calls[0][0].text).toContain('Plan: Agency');
  });

  it('needs a signed-in account', async () => {
    fake.session = null;
    expect((await post({ message: 'Hi', page: '/' })).status).toBe(401);
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('asks for a message that fits, and sends nothing until there is one', async () => {
    const empty = await post({ message: '   ', page: '/' });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'Write a message first.' });
    const long = await post({ message: 'x'.repeat(3001), page: '/' });
    expect(await long.json()).toEqual({ error: 'Keep it under 3,000 characters.' });
    expect((await post('not json')).status).toBe(400);
    expect((await post({ message: 42 })).status).toBe(400);
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('leaves out a page that is not a path on this site', async () => {
    await post({ message: 'Hi', page: 'https://evil.example/' });
    expect(fake.send.mock.calls[0][0].text).toContain('Page: not given');
  });

  it("says feedback isn't set up without OWNER_EMAIL", async () => {
    vi.stubEnv('OWNER_EMAIL', '');
    const res = await post({ message: 'Hi', page: '/' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Feedback isn't set up yet. Try again later." });
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('takes 10 messages an hour from one account', async () => {
    for (let i = 0; i < 10; i++) expect((await post({ message: `Note ${i}`, page: '/' })).status).toBe(200);
    const res = await post({ message: 'One more', page: '/' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "You've sent 10 messages this hour. Try again later." });
    expect(fake.send).toHaveBeenCalledTimes(10);
  });

  it("says when the email couldn't go, without the mail server's words", async () => {
    fake.send.mockResolvedValue({ ok: false, status: 502, error: 'smtp 550 relay denied' });
    const res = await post({ message: 'Hi', page: '/' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Couldn't send your feedback. Try again in a minute." });
  });
});
