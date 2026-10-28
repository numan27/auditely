// The daily job behind Google's 30-day limit on place details. Vercel's cron
// calls it with CRON_SECRET; it only counts until PLACE_DATA_ERASE is "on".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const erase = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/places/placeDataErase', () => ({ erasePlaceData: erase }));

const { GET } = await import('@/app/api/cron/place-data/route');

const SECRET = 'cron-secret-that-is-long-enough-1234';
const call = async (authorization?: string) => {
  const headers = authorization ? { authorization } : undefined;
  const res = await GET(new NextRequest('http://localhost/api/cron/place-data', { headers }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('PLACE_DATA_ERASE', '');
  erase.mockReset().mockResolvedValue({ count: 760 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cron/place-data', () => {
  it('only counts while PLACE_DATA_ERASE is off', async () => {
    const { status, json } = await call(`Bearer ${SECRET}`);
    expect(status).toBe(200);
    expect(json).toEqual({ erase: false, count: 760 });
    expect(erase).toHaveBeenCalledWith(false);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('760'));
  });

  it('blanks the old details once PLACE_DATA_ERASE is "on"', async () => {
    vi.stubEnv('PLACE_DATA_ERASE', 'on');
    const { json } = await call(`Bearer ${SECRET}`);
    expect(json).toEqual({ erase: true, count: 760 });
    expect(erase).toHaveBeenCalledWith(true);
  });

  it('answers only the cron, with its secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(erase).not.toHaveBeenCalled();
  });

  it('stays shut until CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { status } = await call('Bearer ');
    expect(status).toBe(503);
    expect(erase).not.toHaveBeenCalled();
  });

  it('says so when the job fails', async () => {
    erase.mockResolvedValue({ error: 'permission denied' });
    const { status } = await call(`Bearer ${SECRET}`);
    expect(status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[place-data]'), 'permission denied');
  });
});
