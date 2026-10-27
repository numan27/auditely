import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pdf/route';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/pdf', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/pdf', () => {
  it('downloads the rendered PDF as a file', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: true, pdf: Buffer.from('%PDF-1.4'), filename: 'audit-smile-dental.pdf' });
    const res = await post({ audit_id: 'a1' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="audit-smile-dental.pdf"');
  });

  it('passes on why there is no PDF', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 404, error: 'AI report not found — generate the report first' });
    const res = await post({ audit_id: 'a1' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('AI report not found — generate the report first');
  });

  it('draws the full report unless the Upwork version is asked for', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: true, pdf: Buffer.from('%PDF-1.4'), filename: 'audit-smile-dental.pdf' });
    await post({ audit_id: 'a1' });
    await post({ audit_id: 'a1', variant: 'upwork' });
    // Anything it does not know is the full report, never an error
    await post({ audit_id: 'a1', variant: 'print' });
    expect(vi.mocked(renderAuditPdf).mock.calls.slice(-3)).toEqual([[{}, 'a1', 'full'], [{}, 'a1', 'upwork'], [{}, 'a1', 'full']]);
  });

  it('asks for an audit id', async () => {
    expect((await post({})).status).toBe(400);
  });
});
