// The account's saved searches, for the Saved searches page and the home page's
// recent ones: the list, or why it couldn't be loaded (never an empty list that
// looks like no searches at all).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSavedSearches } from '@/app/_shared/lib/utils/savedSearches';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const search = { id: 's1', niche: 'dentists', location: 'austin', created_at: '2026-10-28T00:00:00Z', business_count: 12 };

describe('loadSavedSearches', () => {
  it('gives the searches', async () => {
    fetchMock.mockResolvedValue(Response.json({ searches: [search] }));
    expect(await loadSavedSearches()).toEqual({ ok: true, searches: [search] });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/searches');
  });

  it('gives an empty list when there are none', async () => {
    fetchMock.mockResolvedValue(Response.json({ searches: [] }));
    expect(await loadSavedSearches()).toEqual({ ok: true, searches: [] });
  });

  it("passes on the server's reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Couldn't load your saved searches. Try again in a minute." }, { status: 500 }));
    expect(await loadSavedSearches()).toEqual({ ok: false, error: "Couldn't load your saved searches. Try again in a minute." });
  });

  it("says it couldn't load them when the answer isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response('<html>An error occurred</html>', { status: 504 }));
    expect(await loadSavedSearches()).toEqual({ ok: false, error: "Couldn't load your saved searches. Try again in a minute." });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await loadSavedSearches()).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
  });
});
