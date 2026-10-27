import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportToken, verifyReportToken } from '@/app/_shared/lib/auth/reportLink';
import { sign } from '@/app/_shared/lib/auth/signing';

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

afterEach(() => vi.unstubAllEnvs());

describe('report links', () => {
  it('turns a token back into its audit id', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = await reportToken(AUDIT);
    expect(token).toMatch(new RegExp(`^${AUDIT}\\.[A-Za-z0-9_-]+$`));
    expect(await verifyReportToken(token!)).toBe(AUDIT);
  });

  it('refuses a changed signature, another audit, or garbage', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = (await reportToken(AUDIT))!;
    const signature = token.slice(AUDIT.length + 1);
    const flipped = signature[0] === 'A' ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    expect(await verifyReportToken(`${AUDIT}.${flipped}`)).toBeNull();
    expect(await verifyReportToken(`${OTHER}.${signature}`)).toBeNull();
    expect(await verifyReportToken('nonsense')).toBeNull();
    expect(await verifyReportToken('')).toBeNull();
  });

  // AUTH_SECRET may sign other things; only a signature made for a report opens one
  it('never accepts a signature made with the same secret for anything else', async () => {
    const secret = 'a'.repeat(40);
    vi.stubEnv('AUTH_SECRET', secret);
    expect(await verifyReportToken(`${AUDIT}.${await sign(AUDIT, secret)}`)).toBeNull();
    expect(await verifyReportToken(`${AUDIT}.${await sign(`session:${AUDIT}`, secret)}`)).toBeNull();
    const exp = String(Date.now() + 60_000);
    expect(await verifyReportToken(`${exp}.${await sign(exp, secret)}`)).toBeNull();
  });

  it('stops working when the secret changes, and is off without one', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = (await reportToken(AUDIT))!;
    vi.stubEnv('AUTH_SECRET', 'b'.repeat(40));
    expect(await verifyReportToken(token)).toBeNull();
    vi.stubEnv('AUTH_SECRET', '');
    expect(await reportToken(AUDIT)).toBeNull();
    expect(await verifyReportToken(token)).toBeNull();
  });
});
