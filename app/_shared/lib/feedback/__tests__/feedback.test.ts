import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEEDBACK_MAX, feedbackEmail, feedbackPage, feedbackProblem, sendFeedback } from '@/app/_shared/lib/feedback/feedback';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('feedbackProblem', () => {
  it('asks for a message, and one that fits', () => {
    expect(feedbackProblem('')).toBe('Write a message first.');
    expect(feedbackProblem('  \n ')).toBe('Write a message first.');
    expect(feedbackProblem('x'.repeat(FEEDBACK_MAX + 1))).toBe('Keep it under 3,000 characters.');
    expect(feedbackProblem(`  ${'x'.repeat(FEEDBACK_MAX)}  `)).toBeNull();
    expect(feedbackProblem('The PDF button did nothing.')).toBeNull();
  });
});

describe('feedbackPage', () => {
  it('keeps a path on this site, and nothing else', () => {
    expect(feedbackPage('/search/abc')).toBe('/search/abc');
    expect(feedbackPage('//evil.example')).toBeNull();
    expect(feedbackPage('https://evil.example/')).toBeNull();
    expect(feedbackPage(`/${'a'.repeat(200)}`)).toBeNull();
    expect(feedbackPage(42)).toBeNull();
    expect(feedbackPage(undefined)).toBeNull();
  });
});

describe('feedbackEmail', () => {
  it('goes to the owner, says who sent it from where, and replies to the tester', () => {
    const email = feedbackEmail({
      to: 'owner@auditely.app',
      message: '  The PDF button did nothing.\nTried twice.  ',
      from: 'tester@example.com',
      plan: 'Free',
      page: '/search',
      sentAt: new Date('2026-10-28T12:00:00.000Z'),
    });
    expect(email).toEqual({
      to: 'owner@auditely.app',
      replyTo: 'tester@example.com',
      subject: 'Auditely feedback from tester@example.com',
      text: 'The PDF button did nothing.\nTried twice.\n\nFrom: tester@example.com\nPlan: Free\nPage: /search\nSent: Wed, 28 Oct 2026 12:00:00 GMT',
      attachments: [],
    });
  });

  it("says when the page isn't known", () => {
    const email = feedbackEmail({ to: 'o@x.com', message: 'Hi', from: 't@x.com', plan: 'Pro', page: null, sentAt: new Date(0) });
    expect(email.text).toContain('Page: not given');
  });
});

describe('sendFeedback', () => {
  it('posts the message and the page, and hands back the server’s message when it fails', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    expect(await sendFeedback('It works', '/plans')).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/feedback');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ message: 'It works', page: '/plans' }) });

    fetchMock.mockResolvedValueOnce(json(429, { error: "You've sent 10 messages this hour. Try again later." }));
    expect(await sendFeedback('Again', '/')).toEqual({ ok: false, error: "You've sent 10 messages this hour. Try again later." });
  });

  it('says when Auditely is unreachable or answers something else', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await sendFeedback('Hi', '/')).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    expect(await sendFeedback('Hi', '/')).toEqual({ ok: false, error: "Couldn't send your feedback. Try again in a minute." });
  });
});
