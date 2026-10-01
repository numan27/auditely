import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/report/[token]/route';
import { reportToken } from '@/app/_shared/lib/auth/reportLink';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const open = (token: string) => GET(new NextRequest(`http://localhost/report/${token}`), { params: Promise.resolve({ token }) });

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
  vi.mocked(renderAuditPdf).mockReset().mockResolvedValue({ ok: true, pdf: Buffer.from('%PDF-1.4'), filename: 'audit-smile-dental.pdf' });
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /report/[token]', () => {
  it("shows the audit's PDF in the browser for a valid link", async () => {
    const res = await open((await reportToken(AUDIT))!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('inline; filename="audit-smile-dental.pdf"');
    expect(renderAuditPdf).toHaveBeenCalledWith(AUDIT);
  });

  it('answers 404 for a changed link without touching the audit', async () => {
    const res = await open(`${AUDIT}.not-the-signature`);
    expect(res.status).toBe(404);
    expect(renderAuditPdf).not.toHaveBeenCalled();
  });

  it('answers 404 when the audit or its report is gone', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 404, error: 'Audit not found' });
    expect((await open((await reportToken(AUDIT))!)).status).toBe(404);
  });
});
