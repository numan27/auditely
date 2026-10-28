import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPdf, pdfDownloadName, requestPdf } from '@/app/_shared/lib/hooks/useBusinessAudit';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('%PDF-1.4'));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPdf', () => {
  it('asks the server for the full report', async () => {
    await requestPdf('a1', 'full', false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pdf');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ audit_id: 'a1', variant: 'full' });
  });

  it('asks for the Upwork version by name', async () => {
    await requestPdf('a1', 'upwork', false);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ audit_id: 'a1', variant: 'upwork' });
  });

  // The demo has no server behind it: its reports are built ahead
  it("fetches the demo's ready-made report instead", async () => {
    await requestPdf('demo-a1', 'full', true);
    expect(fetchMock.mock.calls[0]).toEqual(['/demo/report/demo-a1']);
  });
});

// What the card shows: the file, or why there isn't one
describe('fetchPdf', () => {
  it('gives the file', async () => {
    const result = await fetchPdf('a1', 'full', false);
    if (!result.ok) throw new Error(result.error);
    expect(await result.blob.text()).toBe('%PDF-1.4');
  });

  it("passes on the server's reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "The summary isn't written yet. Download the PDF once it shows." }, { status: 404 }));
    expect(await fetchPdf('a1', 'full', false)).toEqual({ ok: false, error: "The summary isn't written yet. Download the PDF once it shows." });
  });

  it("says the PDF wasn't made when the server gives no reason", async () => {
    fetchMock.mockResolvedValue(new Response('<html>An error occurred</html>', { status: 504 }));
    expect(await fetchPdf('a1', 'full', false)).toEqual({ ok: false, error: "Couldn't make the PDF. Try again in a minute." });
  });

  it("says Auditely couldn't be reached when there's no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchPdf('a1', 'full', false)).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
  });
});

describe('pdfDownloadName', () => {
  it('names the download after the business', () => {
    expect(pdfDownloadName('Smile Dental', 'full')).toBe('audit-smile-dental.pdf');
  });

  it('marks the Upwork version, so the two downloads are told apart', () => {
    expect(pdfDownloadName('Smile Dental', 'upwork')).toBe('audit-smile-dental-upwork.pdf');
  });
});
