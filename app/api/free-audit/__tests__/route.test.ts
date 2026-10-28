import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// BotID, the store, the summary, the address lookup and the audit itself are stand-ins
const bot = vi.hoisted(() => ({ current: false }));
const host = vi.hoisted(() => ({ current: 'public' as string }));
const store = vi.hoisted(() => ({
  claimFreeAudit: vi.fn(),
  releaseFreeAudit: vi.fn(),
  saveFreeAudit: vi.fn(),
  findFreeAudit: vi.fn(),
}));
const audit = vi.hoisted(() => vi.fn());
const REPORT = vi.hoisted(() => ({ summary: 'Your site is slow on phones.', improvements: ['Compress the images'], cold_email: 'Hi' }));

vi.mock('botid/server', () => ({ checkBotId: async () => ({ isBot: bot.current }) }));
vi.mock('@/app/_shared/lib/freeAudit/freeAuditStore', () => store);
vi.mock('@/app/_shared/lib/freeAudit/freeReport', () => ({ writeFreeReport: async () => REPORT }));
vi.mock('@/app/_shared/lib/utils/publicAddress', async (orig) => ({
  ...(await orig<typeof import('@/app/_shared/lib/utils/publicAddress')>()),
  publicHost: async () => host.current,
}));
vi.mock('@/app/_shared/lib/audit/runAudit', async (orig) => ({
  ...(await orig<typeof import('@/app/_shared/lib/audit/runAudit')>()),
  runAudit: audit,
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));

const { POST } = await import('@/app/api/free-audit/route');
const { AuditUnavailableError } = await import('@/app/_shared/lib/audit/runAudit');
const { pageSpeedStore } = await import('@/app/_shared/lib/audit/pageSpeedStore');
const { FREE_AUDIT_COOKIE, FREE_AUDIT_COPY, signFreeAuditCookie, visitorHash } = await import(
  '@/app/_shared/lib/freeAudit/freeAuditRules'
);

const SECRET = 'a'.repeat(40);
const SALT = 's'.repeat(16);
const ROW = {
  performance_score: 41,
  seo_score: 80,
  mobile_score: 41,
  ssl_valid: true,
  geo_score: 50,
  aeo_score: 60,
  lead_score: 70,
  checks: {},
  raw_json: { mobile: null, desktop: null },
  engine_version: 3,
};
const SAVED = {
  id: '6f1f3c1e-8a4b-4c55-9a51-0d7a2b1c9e10',
  website: 'https://www.firstaudit.com',
  audit: ROW,
  report: REPORT,
  createdAt: '2026-11-01T10:00:00.000Z',
  claimedBy: null,
};

const request = (body: unknown, cookie?: string) =>
  new NextRequest('http://localhost/api/free-audit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9, 10.0.0.1',
      ...(cookie ? { cookie: `${FREE_AUDIT_COOKIE}=${cookie}` } : {}),
    },
  });

beforeEach(() => {
  vi.stubEnv('FREE_AUDIT_ENABLED', 'true');
  vi.stubEnv('FREE_AUDIT_IP_SALT', SALT);
  vi.stubEnv('AUTH_SECRET', SECRET);
  vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', 'k');
  vi.stubEnv('FREE_AUDIT_DAILY_CAP', '');
  vi.stubEnv('FREE_AUDIT_WINDOW_DAYS', '');
  bot.current = false;
  host.current = 'public';
  for (const fn of Object.values(store)) fn.mockReset();
  store.claimFreeAudit.mockResolvedValue({ ok: true, id: 'f1' });
  store.saveFreeAudit.mockResolvedValue(undefined);
  store.findFreeAudit.mockResolvedValue(null);
  audit.mockReset();
  audit.mockResolvedValue({ row: ROW, email: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/free-audit', () => {
  it('says sign up to audit a website when free audits are off', async () => {
    vi.stubEnv('FREE_AUDIT_ENABLED', '');
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: 'off', error: 'Sign up to audit a website.' });
  });

  it("says free audits aren't available, and names what's missing in the log, when they can't run", async () => {
    vi.stubEnv('FREE_AUDIT_IP_SALT', '');
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: 'unavailable', error: FREE_AUDIT_COPY.unavailable });
    expect(console.error).toHaveBeenCalledWith('[free-audit] Not set up: FREE_AUDIT_IP_SALT');
    expect(store.claimFreeAudit).not.toHaveBeenCalled();
  });

  it('shows the visitor their own audit again without claiming another', async () => {
    store.findFreeAudit.mockResolvedValue(SAVED);
    const res = await POST(request({ website: 'another.com' }, await signFreeAuditCookie(SAVED.id, SECRET)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      again: true,
      result: {
        website: 'https://www.firstaudit.com',
        host: 'firstaudit.com',
        createdAt: '2026-11-01T10:00:00.000Z',
        audit: ROW,
        report: { summary: REPORT.summary, improvements: REPORT.improvements },
      },
    });
    expect(store.findFreeAudit).toHaveBeenCalledWith(SAVED.id);
    expect(store.claimFreeAudit).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('ignores a forged cookie and runs the normal checks', async () => {
    const forged = (await signFreeAuditCookie(SAVED.id, SECRET)).slice(0, -2) + 'xx';
    const res = await POST(request({ website: 'example.com' }, forged));
    expect(res.status).toBe(200);
    expect(store.findFreeAudit).not.toHaveBeenCalled();
    expect(store.claimFreeAudit).toHaveBeenCalled();
  });

  it("asks for a website address when it isn't one", async () => {
    const res = await POST(request({ website: 'not a site' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, reason: 'invalid', error: 'Enter a website address, like example.com.' });
  });

  it('refuses a bot before claiming', async () => {
    bot.current = true;
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: 'bot', error: FREE_AUDIT_COPY.bot });
    expect(store.claimFreeAudit).not.toHaveBeenCalled();
  });

  it('refuses a site that points to a private address, without claiming', async () => {
    host.current = 'private';
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: 'notPublic', error: FREE_AUDIT_COPY.notPublic });
    expect(store.claimFreeAudit).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("says a site that doesn't exist wasn't found, and a lookup that failed to try again", async () => {
    host.current = 'notFound';
    let res = await POST(request({ website: 'www.example.com' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'failed', error: "example.com wasn't found. Check the address and try again." });
    host.current = 'lookupFailed';
    res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'failed', error: "Couldn't look up example.com. Try again in a minute." });
    expect(store.claimFreeAudit).not.toHaveBeenCalled();
  });

  it('refuses a second audit from the same network, and past the daily cap', async () => {
    store.claimFreeAudit.mockResolvedValue({ ok: false, reason: 'visitor' });
    let res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: 'visitor', error: FREE_AUDIT_COPY.visitor });
    store.claimFreeAudit.mockResolvedValue({ ok: false, reason: 'cap' });
    res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: 'cap', error: FREE_AUDIT_COPY.cap });
    expect(audit).not.toHaveBeenCalled();
  });

  it("says free audits aren't available when the claim itself fails", async () => {
    store.claimFreeAudit.mockRejectedValue(new Error('free_audits: relation does not exist'));
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'unavailable', error: FREE_AUDIT_COPY.unavailable });
    expect(audit).not.toHaveBeenCalled();
  });

  it("releases the claim when the site can't be audited, and sets no cookie", async () => {
    audit.mockRejectedValue(new AuditUnavailableError('The site took too long to answer.'));
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(
      "Couldn't audit example.com: The site took too long to answer. Check the address and try again. This didn't use your free audit."
    );
    expect(store.releaseFreeAudit).toHaveBeenCalledWith('f1');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('releases the claim when the audit breaks on our side', async () => {
    audit.mockRejectedValue(new Error('cheerio exploded'));
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(FREE_AUDIT_COPY.failed('example.com', 'something went wrong on our side'));
    expect(store.releaseFreeAudit).toHaveBeenCalledWith('f1');
  });

  it('releases the claim when saving fails', async () => {
    store.saveFreeAudit.mockRejectedValue(new Error('free_audits: down'));
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, reason: 'failed' });
    expect(store.releaseFreeAudit).toHaveBeenCalledWith('f1');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('saves the audit and sets a signed, httpOnly cookie for the window', async () => {
    const res = await POST(request({ website: 'example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      again: false,
      result: { website: 'https://example.com', host: 'example.com', audit: ROW, report: { summary: REPORT.summary } },
    });
    expect(body.result.report).not.toHaveProperty('cold_email');
    expect(store.saveFreeAudit).toHaveBeenCalledWith('f1', ROW, REPORT);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${FREE_AUDIT_COOKIE}=f1.`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(store.releaseFreeAudit).not.toHaveBeenCalled();
  });

  it('audits through the shared PageSpeed cache without looking for an email', async () => {
    await POST(request({ website: 'example.com' }));
    const [input, deps] = audit.mock.calls[0];
    expect(input).toMatchObject({ website: 'https://example.com', name: 'example.com', address: '', phone: null, refreshPageSpeed: false });
    expect(input.discoverEmail).toBeUndefined();
    expect(deps).toEqual({ pageSpeedStore });
  });

  it('counts the visitor by a salted hash, never the address', async () => {
    await POST(request({ website: 'example.com' }));
    expect(store.claimFreeAudit.mock.calls[0][0].ipHash).toBe(visitorHash('203.0.113.9', SALT));
    const everything = JSON.stringify([...Object.values(store).map((fn) => fn.mock.calls), audit.mock.calls]);
    expect(everything).not.toContain('203.0.113.9');
  });
});
