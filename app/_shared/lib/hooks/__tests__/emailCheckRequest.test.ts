import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestEmailCheck } from '@/app/_shared/lib/hooks/useEmailSend';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

const CHECK = { address: 'office@smiledental.com', verdict: 'Undeliverable', status: 'MailboxDoesNotExist', checked_at: '2026-10-05T10:00:00Z' };
const NOT_RUN = { state: 'unchecked', reason: "Not checked: the check couldn't be run." };
const fetchMock = vi.fn();
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestEmailCheck', () => {
  it("asks the server about the business's address", async () => {
    answer({ state: 'checked', check: CHECK });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'checked', check: CHECK });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_ROUTES.VERIFY_EMAIL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ business_id: 'b1' });
    // Bounded, so the dialog can't wait forever
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes on a warning, a reason, and "off"', async () => {
    answer({ state: 'checked', check: CHECK, warning: "Checked, but the result couldn't be saved." });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'checked', check: CHECK, warning: "Checked, but the result couldn't be saved." });
    answer({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    answer({ state: 'off' });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'off' });
  });

  // Whatever goes wrong reads as "not checked": the dialog is never stuck, and never blocked by a failure
  it.each([
    ['an error answer', () => answer({ error: 'Business not found' }, 404)],
    ['a server crash', () => fetchMock.mockResolvedValue(new Response('<html>500</html>', { status: 500 }))],
    ['an answer that is not JSON', () => fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))],
    ['a null answer', () => answer(null)],
    ['a state it does not know', () => answer({ state: 'maybe' })],
    ['a check that is not a check', () => answer({ state: 'checked', check: { verdict: 'Undeliverable' } })],
    ['no reason', () => answer({ state: 'unchecked' })],
    ['a lost connection', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
    ['a timeout', () => fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))],
  ])('counts %s as not checked', async (_name, arrange) => {
    arrange();
    expect(await requestEmailCheck('b1')).toEqual(NOT_RUN);
  });
});
