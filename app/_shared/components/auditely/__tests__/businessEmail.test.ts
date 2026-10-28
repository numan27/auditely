// "Find email" on a card: an email found, none found (and whether the plan kept the
// search to the website), or a search that didn't finish, which isn't "none found".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findEmail } from '@/app/_shared/components/auditely/businessEmail/businessEmail';

const fetchMock = vi.fn();
const limit = { kind: 'email_lookup', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('findEmail', () => {
  it('gives the email found, asking for this one business', async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [{ id: 'b1', email: 'hi@smile.com' }] }));
    expect(await findEmail('b1', true)).toEqual({ ok: true, email: 'hi@smile.com', limited: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ business_ids: ['b1'], apiFallback: true });
  });

  it('says none was found, and whether the plan kept it to the website', async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [{ id: 'b1', email: null }], limit }));
    expect(await findEmail('b1', false)).toEqual({ ok: true, email: null, limited: true });
    fetchMock.mockResolvedValue(Response.json({ results: [{ id: 'b1', email: null }] }));
    expect(await findEmail('b1', true)).toEqual({ ok: true, email: null, limited: false });
  });

  it("says the search didn't finish when the answer is an error page, not that there's no email", async () => {
    fetchMock.mockResolvedValue(new Response('<html>An error occurred</html>', { status: 504 }));
    expect(await findEmail('b1', true)).toEqual({ ok: false, error: "The email search didn't finish." });
  });

  it("passes on the server's reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'Sign in to continue' }, { status: 401 }));
    expect(await findEmail('b1', true)).toEqual({ ok: false, error: 'Sign in to continue' });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await findEmail('b1', true)).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
  });
});
