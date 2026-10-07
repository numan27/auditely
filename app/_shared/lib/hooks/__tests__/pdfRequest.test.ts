import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pdfDownloadName, requestPdf } from '@/app/_shared/lib/hooks/useBusinessAudit';

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

describe('pdfDownloadName', () => {
  it('names the download after the business', () => {
    expect(pdfDownloadName('Smile Dental', 'full')).toBe('audit-smile-dental.pdf');
  });

  it('marks the Upwork version, so the two downloads are told apart', () => {
    expect(pdfDownloadName('Smile Dental', 'upwork')).toBe('audit-smile-dental-upwork.pdf');
  });
});
