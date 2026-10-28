import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET, generateStaticParams } from '@/app/demo/report/[auditId]/route';
import { renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples } from '@/app/_shared/lib/demo/demoSamples';

// Nothing here may load the database client: without its settings (as in this
// test run) importing it throws, which would fail this file at import.
vi.mock('@/app/_shared/lib/audit/pdfRender', async (original) => ({
  ...(await original<typeof import('@/app/_shared/lib/audit/pdfRender')>()),
  renderPdf: vi.fn(async () => Buffer.from('%PDF-1.4')),
}));

const open = (auditId: string) =>
  GET(new Request(`http://localhost/demo/report/${auditId}`), { params: Promise.resolve({ auditId }) });
const first = demoData.leads[0];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(renderPdf).mockClear();
});

describe('GET /demo/report/[auditId]', () => {
  it('is built ahead for every sample audit', () => {
    expect(generateStaticParams()).toEqual(allSamples(demoData).map((b) => ({ auditId: b.audit!.id })));
  });

  it("downloads a sample audit's PDF under Auditely's name, without a contact box", async () => {
    const res = await open(first.audit!.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="audit-[a-z0-9-]+\.pdf"$/);
    // As an account without a brand of its own would send it: never the owner's
    expect(vi.mocked(renderPdf).mock.calls[0][3]).toMatchObject({ kind: 'auditely', name: 'Auditely', contact: null });
  });

  it('keeps the reports out of search engines', async () => {
    expect((await open(first.audit!.id)).headers.get('x-robots-tag')).toBe('noindex');
  });

  it("never adds the owner's contact details, even with the old DEMO_PDF_CONTACT switch on", async () => {
    vi.stubEnv('DEMO_PDF_CONTACT', '1');
    await open(first.audit!.id);
    expect(vi.mocked(renderPdf).mock.calls[0][3]).toMatchObject({ kind: 'auditely', contact: null });
  });

  it('answers 404 for anything that is not a sample audit, without drawing a PDF', async () => {
    for (const id of ['demo-a999', '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f', '']) {
      expect((await open(id)).status).toBe(404);
    }
    expect(renderPdf).not.toHaveBeenCalled();
  });
});
