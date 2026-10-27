import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransport } from 'nodemailer';
import { isPrivateAddress, mailTransport, resolveMailHost, verifyMailbox } from '@/app/_shared/lib/email/mailbox';
import { MAILBOX_PRESETS, parseMailbox, type MailboxSettings } from '@/app/_shared/lib/email/mailboxPresets';

// The real nodemailer, watched, so a test can hand verifyMailbox a transport that answers as a server would
vi.mock('nodemailer', async (importOriginal) => {
  const real = await importOriginal<typeof import('nodemailer')>();
  return { ...real, createTransport: vi.fn(real.createTransport) };
});

const GMAIL: MailboxSettings = { host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass', fromEmail: 'sam@acme.studio' };
const PUBLIC = async () => [{ address: '142.250.1.108', family: 4 }];
const answering = (verify: () => Promise<unknown>) =>
  vi.mocked(createTransport).mockReturnValueOnce({ verify } as unknown as ReturnType<typeof createTransport>);
const smtpError = (over: Record<string, unknown>) => Object.assign(new Error('smtp'), over);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('resolveMailHost', () => {
  it.each(['127.0.0.1', '10.0.0.5', '::1', 'localhost', 'mail.localhost', 'mail.internal', 'printer.local', 'intranet'])(
    'refuses %s before any lookup',
    async (host) => {
      const lookup = vi.fn();
      expect(await resolveMailHost(host, lookup)).toEqual({ ok: false, error: "Use your mail provider's SMTP server name, like smtp.gmail.com." });
      expect(lookup).not.toHaveBeenCalled();
    }
  );

  it.each(['169.254.169.254', '192.168.1.10', '100.64.0.1', '0.0.0.0', '::1', '::ffff:10.0.0.1', 'fd00::1', 'fe80::1'])(
    'refuses a name that points to %s',
    async (address) => {
      expect(await resolveMailHost('smtp.evil.com', async () => [{ address, family: address.includes(':') ? 6 : 4 }])).toEqual({
        ok: false,
        error: "smtp.evil.com doesn't point to a public mail server.",
      });
    }
  );

  it('refuses a name when any one of its addresses is private', async () => {
    const lookup = async () => [
      { address: '142.250.1.108', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ];
    expect((await resolveMailHost('smtp.evil.com', lookup)).ok).toBe(false);
  });

  it('says when the name was not found', async () => {
    const lookup = async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND smtp.nope.com'), { code: 'ENOTFOUND' });
    };
    expect(await resolveMailHost('smtp.nope.com', lookup)).toEqual({ ok: false, error: "smtp.nope.com wasn't found. Check the server name." });
  });

  it('connects over IPv4 when the name has both, as nodemailer did, so an IPv4-only host still reaches it', async () => {
    const both = async () => [
      { address: '2607:f8b0:4023:c06::6c', family: 6 },
      { address: '142.250.1.108', family: 4 },
    ];
    expect(await resolveMailHost('smtp.gmail.com', both)).toEqual({ ok: true, address: '142.250.1.108' });
    const ipv6Only = async () => [{ address: '2607:f8b0:4023:c06::6c', family: 6 }];
    expect(await resolveMailHost('smtp.gmail.com', ipv6Only)).toEqual({ ok: true, address: '2607:f8b0:4023:c06::6c' });
  });

  it('returns the checked public address, which the transport then connects to', async () => {
    expect(await resolveMailHost('smtp.gmail.com', PUBLIC)).toEqual({ ok: true, address: '142.250.1.108' });
    const t = mailTransport(GMAIL, '142.250.1.108');
    expect(t.options).toMatchObject({
      host: '142.250.1.108',
      port: 465,
      secure: true,
      requireTLS: true,
      tls: { servername: 'smtp.gmail.com' },
      auth: { user: 'sam@acme.studio', pass: 'app-pass' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    expect(mailTransport({ ...GMAIL, port: 587 }, '142.250.1.108').options).toMatchObject({ port: 587, secure: false, requireTLS: true });
  });
});

describe('isPrivateAddress', () => {
  it('knows public addresses from the rest', () => {
    for (const address of ['142.250.1.108', '2607:f8b0:4004:c1b::6c']) expect(isPrivateAddress(address)).toBe(false);
    for (const address of ['172.16.0.1', '192.0.0.8', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::', 'ff02::1', '::ffff:a00:1', 'not an address'])
      expect(isPrivateAddress(address)).toBe(true);
  });
});

describe('verifyMailbox', () => {
  it('logs in to the checked address', async () => {
    const verify = vi.fn(async () => true);
    answering(verify);
    expect(await verifyMailbox(GMAIL, PUBLIC)).toEqual({ ok: true });
    expect(verify).toHaveBeenCalled();
    expect(createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ host: '142.250.1.108', tls: { servername: 'smtp.gmail.com' } }));
  });

  it('refuses a private server without connecting', async () => {
    vi.mocked(createTransport).mockClear();
    expect(await verifyMailbox({ ...GMAIL, host: 'smtp.evil.com' }, async () => [{ address: '10.0.0.1', family: 4 }])).toEqual({
      ok: false,
      error: "smtp.evil.com doesn't point to a public mail server.",
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('says what the server answered, in words a person can act on', async () => {
    answering(async () => {
      throw smtpError({ code: 'EAUTH', response: '535 5.7.8 Username and Password not accepted' });
    });
    expect(await verifyMailbox(GMAIL, PUBLIC)).toEqual({ ok: false, error: 'The mailbox refused the login. Check the email address and app password.' });

    answering(async () => {
      throw smtpError({ code: 'EAUTH', response: '535 Authentication Failed. access restricted' });
    });
    expect(await verifyMailbox({ ...GMAIL, host: 'smtppro.zoho.com' }, PUBLIC)).toEqual({
      ok: false,
      error: "smtppro.zoho.com isn't the server for this mailbox. A free Zoho account uses smtp.zoho.com, a paid one smtppro.zoho.com.",
    });

    answering(async () => {
      throw smtpError({ code: 'ETIMEDOUT' });
    });
    expect(await verifyMailbox({ ...GMAIL, port: 587 }, PUBLIC)).toEqual({ ok: false, error: "Couldn't reach smtp.gmail.com on port 587. Check the server and port." });
  });

  it('never logs the password', async () => {
    answering(async () => {
      throw smtpError({ code: 'EAUTH', response: '535 rejected' });
    });
    await verifyMailbox(GMAIL, PUBLIC);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('app-pass');
  });
});

describe('parseMailbox', () => {
  it('reads the presets’ ports and rejects anything but 465 and 587', () => {
    expect(parseMailbox({ host: 'smtp.gmail.com', port: 25, user: 'a@x.com', pass: 'p' })).toEqual({ ok: false, error: 'The port must be 465 or 587.' });
    expect(parseMailbox({ host: 'SMTP.Gmail.com ', port: 465, user: 'a@x.com', pass: ' p ' })).toEqual({
      ok: true,
      mailbox: { host: 'smtp.gmail.com', port: 465, user: 'a@x.com', pass: ' p ', fromEmail: 'a@x.com' },
    });
    expect(parseMailbox({ host: 'smtp.office365.com', port: 587, user: 'a@x.com', pass: 'p' })).toMatchObject({ ok: true, mailbox: { port: 587 } });
  });

  it('says which field to fix', () => {
    const ok = { host: 'smtp.gmail.com', port: 465, user: 'a@x.com', pass: 'p' };
    expect(parseMailbox({ ...ok, host: 'smtp gmail' })).toEqual({ ok: false, error: "Enter your mail provider's SMTP server, like smtp.gmail.com." });
    expect(parseMailbox({ ...ok, host: 'gmail' })).toEqual({ ok: false, error: "Enter your mail provider's SMTP server, like smtp.gmail.com." });
    expect(parseMailbox({ ...ok, host: `${'a'.repeat(250)}.com` })).toEqual({ ok: false, error: "Enter your mail provider's SMTP server, like smtp.gmail.com." });
    expect(parseMailbox({ ...ok, user: '' })).toEqual({ ok: false, error: "Enter the mailbox's email address." });
    expect(parseMailbox({ ...ok, user: `${'a'.repeat(250)}@x.com` })).toEqual({ ok: false, error: "Enter the mailbox's email address." });
    expect(parseMailbox({ ...ok, pass: '' })).toEqual({ ok: false, error: "Enter the mailbox's app password." });
    expect(parseMailbox({ ...ok, pass: 'p'.repeat(201) })).toEqual({ ok: false, error: "Enter the mailbox's app password." });
    expect(parseMailbox({ ...ok, user: 'sam' })).toEqual({ ok: false, error: 'The From address must be an email address.' });
    expect(parseMailbox({ ...ok, fromEmail: 'nope' })).toEqual({ ok: false, error: 'The From address must be an email address.' });
    expect(parseMailbox(null)).toEqual({ ok: false, error: "Enter your mail provider's SMTP server, like smtp.gmail.com." });
  });

  it('sends from another address on the same login when one is given', () => {
    expect(parseMailbox({ host: 'smtp.zoho.com', port: 465, user: 'sam', pass: 'p', fromEmail: ' hi@acme.studio ' })).toEqual({
      ok: true,
      mailbox: { host: 'smtp.zoho.com', port: 465, user: 'sam', pass: 'p', fromEmail: 'hi@acme.studio' },
    });
  });
});

describe('MAILBOX_PRESETS', () => {
  it('lists the common providers, each with a port the form accepts', () => {
    expect(MAILBOX_PRESETS.map((p) => [p.id, p.host, p.port])).toEqual([
      ['gmail', 'smtp.gmail.com', 465],
      ['outlook', 'smtp.office365.com', 587],
      ['zoho', 'smtp.zoho.com', 465],
      ['other', '', 465],
    ]);
    expect(MAILBOX_PRESETS[0]).toMatchObject({
      label: 'Gmail or Google Workspace',
      help: 'Use an app password: Google Account › Security › App passwords. 2-Step Verification must be on.',
    });
  });
});
