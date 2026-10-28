import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({ bot: false, send: vi.fn() }));
vi.mock('botid/server', () => ({ checkBotId: async () => ({ isBot: fake.bot }) }));
vi.mock('@/app/_shared/lib/email/mailer', () => ({ sendEmail: fake.send }));

const { POST } = await import('@/app/api/contact/route');

const filled = {
  name: 'Sam Rivera',
  email: 'sam@example.com',
  phone: '',
  subject: 'A question about the beta',
  message: 'Can my whole team use one account?',
  website: '',
};

let networks = 0;
/** A new network each time, so the hourly limit of one test doesn't reach the next */
const newNetwork = () => {
  networks += 1;
  return `203.0.113.${networks}`;
};
let ip = newNetwork();
const post = (body: unknown, from = ip) =>
  POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'x-forwarded-for': `${from}, 10.0.0.1` },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'owner@auditely.app');
  fake.bot = false;
  fake.send.mockReset().mockResolvedValue({ ok: true });
  ip = newNetwork();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/contact', () => {
  it('emails the team the message, with replies going to the sender', async () => {
    const res = await post(filled);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fake.send).toHaveBeenCalledTimes(1);
    const [email] = fake.send.mock.calls[0];
    expect(email).toMatchObject({
      to: 'owner@auditely.app',
      replyTo: 'sam@example.com',
      subject: 'Auditely contact: A question about the beta',
    });
    expect(email.text).toContain('Can my whole team use one account?');
    expect(email.text).toContain('From: Sam Rivera <sam@example.com>');
  });

  it('turns a bot away before reading anything', async () => {
    fake.bot = true;
    const res = await post(filled);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Couldn't send your message from this browser. Try another browser, or try again later.");
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('answers a filled hidden field as if it were sent, and sends nothing', async () => {
    const res = await post({ ...filled, website: 'https://spam.example' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("says what's missing, field by field", async () => {
    const res = await post({ ...filled, name: '', email: 'sam@' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Enter your name.',
      problems: { name: 'Enter your name.', email: 'Enter an email like name@company.com.' },
    });
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('reads a body that is not JSON as an empty form', async () => {
    const res = await post('not json');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Enter your name.');
  });

  it('says so while no team address is set', async () => {
    vi.stubEnv('OWNER_EMAIL', '');
    const res = await post(filled);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Messages can't be sent yet. Try again later.");
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('takes five messages an hour from one network', async () => {
    for (let i = 0; i < 5; i += 1) expect((await post(filled)).status).toBe(200);
    const res = await post(filled);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("You've sent 5 messages this hour. Try again later.");
    expect(fake.send).toHaveBeenCalledTimes(5);
    expect((await post(filled, newNetwork())).status).toBe(200);
  });

  it("says when the email couldn't go", async () => {
    fake.send.mockResolvedValue({ ok: false, status: 500, error: 'SMTP down' });
    const res = await post(filled);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Couldn't send your message. Try again in a minute.");
  });
});
