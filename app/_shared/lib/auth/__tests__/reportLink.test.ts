import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportToken, verifyReportToken } from '@/app/_shared/lib/auth/reportLink';
import { createSessionToken } from '@/app/_shared/lib/auth/session';

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

  it('never accepts a session cookie value as a report link', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    expect(await verifyReportToken(await createSessionToken())).toBeNull();
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
