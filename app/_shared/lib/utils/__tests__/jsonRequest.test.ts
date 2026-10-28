// The app's JSON requests: the answer is read safely, so an error page that isn't
// JSON (a timeout, say) or no answer at all still gives the caller something to show.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getJson, postJson, UNREACHABLE } from '@/app/_shared/lib/utils/jsonRequest';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postJson', () => {
  it('posts the body as JSON and reads the answer', async () => {
    fetchMock.mockResolvedValue(Response.json({ audit: { id: 'a1' } }));
    expect(await postJson('/api/audit', { business_id: 'b1' })).toEqual({ ok: true, data: { audit: { id: 'a1' } } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/audit');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ business_id: 'b1' });
  });

  it("passes on the server's error", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'No' }, { status: 502 }));
    expect(await postJson('/api/audit', {})).toEqual({ ok: false, data: { error: 'No' } });
  });

  it("has no data when the answer isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response('<html>An error occurred</html>', { status: 504 }));
    expect(await postJson('/api/audit', {})).toEqual({ ok: false, data: null });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await postJson('/api/audit', {})).toEqual({ ok: false, data: { error: UNREACHABLE } });
    expect(UNREACHABLE).toBe("Couldn't reach Auditely. Check your connection and try again.");
  });

  it('can be cancelled', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    const signal = new AbortController().signal;
    await postJson('/api/audit', {}, signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });
});

describe('getJson', () => {
  it('reads the answer', async () => {
    fetchMock.mockResolvedValue(Response.json({ search: { niche: 'dentists' } }));
    expect(await getJson('/api/results?search_id=s1')).toEqual({ ok: true, data: { search: { niche: 'dentists' } } });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/results?search_id=s1');
  });

  it("has no data when the answer isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response('<html>An error occurred</html>', { status: 504 }));
    expect(await getJson('/api/results')).toEqual({ ok: false, data: null });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await getJson('/api/results')).toEqual({ ok: false, data: { error: UNREACHABLE } });
  });
});
