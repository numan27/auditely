// "Find leads" asks for a new search or a saved one; whatever comes back, the
// page gets the results or a sentence it can show, never "Failed to fetch".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSaved, requestSearch } from '@/app/_shared/lib/hooks/leadSearchRequests';

const fetchMock = vi.fn();
const html504 = () => new Response('<html>An error occurred</html>', { status: 504 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestSearch', () => {
  it('gives the businesses found and the saved search', async () => {
    fetchMock.mockResolvedValue(Response.json({ search_id: 's1', businesses: [{ id: 'b1' }] }));
    expect(await requestSearch('dentists', 'austin')).toEqual({ ok: true, businesses: [{ id: 'b1' }], searchId: 's1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ niche: 'dentists', location: 'austin' });
  });

  it("passes on the server's reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Couldn't search Google Maps just now. Try again in a minute." }, { status: 502 }));
    expect(await requestSearch('dentists', 'austin')).toEqual({
      ok: false,
      error: "Couldn't search Google Maps just now. Try again in a minute.",
      limit: null,
    });
  });

  it('says when the plan has no searches left', async () => {
    const limit = { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-28T00:00:00Z' };
    fetchMock.mockResolvedValue(Response.json({ error: "You've used your search.", limit }, { status: 402 }));
    expect(await requestSearch('dentists', 'austin')).toMatchObject({ ok: false, limit });
  });

  it("says the search didn't finish when the answer isn't JSON", async () => {
    fetchMock.mockResolvedValue(html504());
    expect(await requestSearch('dentists', 'austin')).toEqual({ ok: false, error: "The search didn't finish. Try again in a minute.", limit: null });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await requestSearch('dentists', 'austin')).toEqual({
      ok: false,
      error: "Couldn't reach Auditely. Check your connection and try again.",
      limit: null,
    });
  });
});

describe('requestSaved', () => {
  it('gives the saved search and its businesses', async () => {
    fetchMock.mockResolvedValue(Response.json({ search: { niche: 'dentists', location: 'austin' }, businesses: [{ id: 'b1', audits: [] }] }));
    const result = await requestSaved('s 1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/results?search_id=s%201');
    if (!result.ok) throw new Error(result.error);
    expect(result.search).toEqual({ niche: 'dentists', location: 'austin' });
    expect(result.businesses.map((b) => b.id)).toEqual(['b1']);
  });

  it("says a deleted search isn't saved any more", async () => {
    fetchMock.mockResolvedValue(Response.json({ search: null, businesses: [] }));
    expect(await requestSaved('s1')).toEqual({ ok: false, error: "This search isn't saved any more. Run it again, or open another one." });
  });

  it("passes on the server's reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Couldn't open this search. Try again in a minute." }, { status: 500 }));
    expect(await requestSaved('s1')).toEqual({ ok: false, error: "Couldn't open this search. Try again in a minute." });
  });

  it("says it couldn't open the search when the answer isn't JSON", async () => {
    fetchMock.mockResolvedValue(html504());
    expect(await requestSaved('s1')).toEqual({ ok: false, error: "Couldn't open this search. Try again in a minute." });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await requestSaved('s1')).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
  });
});
