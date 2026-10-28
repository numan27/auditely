import { describe, it, expect } from 'vitest';
import {
  FREE_AUDIT_COPY,
  dayStart,
  freeAuditCookieOptions,
  freeAuditSetup,
  readFreeAuditCookie,
  signFreeAuditCookie,
  visitorHash,
  visitorIp,
  visitorKey,
  windowStart,
} from '@/app/_shared/lib/freeAudit/freeAuditRules';

const SECRET = 'a'.repeat(40);
const SALT = 's'.repeat(16);
const READY = { FREE_AUDIT_ENABLED: 'true', FREE_AUDIT_IP_SALT: SALT, AUTH_SECRET: SECRET, GOOGLE_PAGESPEED_API_KEY: 'k' };

describe('free audit setup', () => {
  it('is off unless FREE_AUDIT_ENABLED is exactly true', () => {
    expect(freeAuditSetup({ FREE_AUDIT_ENABLED: 'yes' })).toEqual({ state: 'off' });
    expect(freeAuditSetup({})).toEqual({ state: 'off' });
  });

  it('names what is missing before it can run', () => {
    expect(freeAuditSetup({ FREE_AUDIT_ENABLED: 'true', FREE_AUDIT_IP_SALT: 'short' })).toEqual({
      state: 'unavailable',
      missing: ['FREE_AUDIT_IP_SALT', 'AUTH_SECRET', 'GOOGLE_PAGESPEED_API_KEY'],
    });
    expect(freeAuditSetup({ ...READY, AUTH_SECRET: 'too-short' })).toEqual({ state: 'unavailable', missing: ['AUTH_SECRET'] });
  });

  it('defaults the cap to 200 and the window to 30 days, and lets 0 pause it', () => {
    expect(freeAuditSetup(READY)).toEqual({ state: 'on', config: { dailyCap: 200, windowDays: 30, salt: SALT, secret: SECRET } });
    const config = (env: Record<string, string>) => {
      const setup = freeAuditSetup({ ...READY, ...env });
      return setup.state === 'on' ? setup.config : null;
    };
    expect(config({ FREE_AUDIT_DAILY_CAP: 'abc' })?.dailyCap).toBe(200);
    expect(config({ FREE_AUDIT_DAILY_CAP: '-3' })?.dailyCap).toBe(200);
    expect(config({ FREE_AUDIT_DAILY_CAP: '0' })?.dailyCap).toBe(0);
    expect(config({ FREE_AUDIT_DAILY_CAP: '50' })?.dailyCap).toBe(50);
    expect(config({ FREE_AUDIT_WINDOW_DAYS: '0' })?.windowDays).toBe(30);
    expect(config({ FREE_AUDIT_WINDOW_DAYS: '7' })?.windowDays).toBe(7);
  });
});

describe('visitors', () => {
  it('reads the first forwarded address', () => {
    expect(visitorIp(new Headers({ 'x-forwarded-for': ' 203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(visitorIp(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(visitorIp(new Headers({ 'x-forwarded-for': 'garbage' }))).toBe('unknown');
    expect(visitorIp(new Headers())).toBe('unknown');
  });

  it('counts an IPv6 visitor by their /64 and a mapped address as its IPv4', () => {
    expect(visitorKey('2001:db8:aa:bb:1:2:3:4')).toBe('2001:0db8:00aa:00bb::/64');
    expect(visitorKey('2001:db8:aa:bb::ffff')).toBe(visitorKey('2001:db8:aa:bb:9:9:9:9'));
    expect(visitorKey('2001:DB8::1')).toBe('2001:0db8:0000:0000::/64');
    expect(visitorKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(visitorKey('203.0.113.9')).toBe('203.0.113.9');
    expect(visitorKey('unknown')).toBe('unknown');
  });

  it('hashes the network with the salt and never returns the address', () => {
    const hash = visitorHash('203.0.113.9', SALT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('203');
    expect(hash).not.toBe(visitorHash('203.0.113.9', 't'.repeat(16)));
    expect(visitorHash('2001:db8:aa:bb::1', SALT)).toBe(visitorHash('2001:db8:aa:bb::2', SALT));
  });
});

describe('the free audit cookie', () => {
  const id = '6f1f3c1e-8a4b-4c55-9a51-0d7a2b1c9e10';

  it('reads back only a cookie it signed', async () => {
    const value = await signFreeAuditCookie(id, SECRET);
    expect(value.startsWith(`${id}.`)).toBe(true);
    expect(await readFreeAuditCookie(value, SECRET)).toBe(id);
    expect(await readFreeAuditCookie(value.replace(id, id.replace('6f', '7f')), SECRET)).toBeNull();
    expect(await readFreeAuditCookie(value, 'x'.repeat(32))).toBeNull();
    expect(await readFreeAuditCookie('not-a-uuid.sig', SECRET)).toBeNull();
    expect(await readFreeAuditCookie(undefined, SECRET)).toBeNull();
    expect(await readFreeAuditCookie(id, SECRET)).toBeNull();
  });

  it("doesn't take a report link's signature for a free audit's", async () => {
    const { sign } = await import('@/app/_shared/lib/auth/signing');
    expect(await readFreeAuditCookie(`${id}.${await sign(`report:${id}`, SECRET)}`, SECRET)).toBeNull();
  });

  it('keeps the cookie for the window, httpOnly', () => {
    expect(freeAuditCookieOptions(30, { NODE_ENV: 'production' })).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 2_592_000,
    });
    expect(freeAuditCookieOptions(7, { NODE_ENV: 'development' }).secure).toBe(false);
  });
});

describe('days and windows', () => {
  it('starts the day at UTC midnight', () => {
    expect(dayStart(new Date('2026-11-03T23:59:00-05:00')).toISOString()).toBe('2026-11-04T00:00:00.000Z');
  });

  it('opens the window the given number of days back', () => {
    expect(windowStart(new Date('2026-11-30T12:00:00Z'), 30).toISOString()).toBe('2026-10-31T12:00:00.000Z');
  });
});

describe('free audit copy', () => {
  it('names the Free allowance and drops the reason’s full stop', () => {
    expect(FREE_AUDIT_COPY.again).toBe(
      "You've had your free audit, so here's the one you ran. Sign up free to keep it and run 5 audits a month."
    );
    expect(FREE_AUDIT_COPY.failed('example.com', 'The site took too long to answer.')).toBe(
      "Couldn't audit example.com: The site took too long to answer. Check the address and try again. This didn't use your free audit."
    );
    expect(FREE_AUDIT_COPY.off).toBe('Sign up to audit a website.');
  });
});
