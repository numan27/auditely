// app/_shared/lib/audit/pdfRender.ts

// Draws an audit's PDF report from data already in hand. No database: the
// download and the report link look the audit up first (auditPdf.ts), the
// public demo passes its saved sample. Server-only.

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { PdfDocument, type PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';

export interface PdfBusiness {
  name: string;
  website: string | null;
  address: string;
  phone: string | null;
}

export const pdfFileName = (businessName: string): string =>
  `audit-${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-')}.pdf`;

/** @param contact null leaves out the "next step" box */
export function renderPdf(
  audit: AuditLike,
  business: PdfBusiness,
  report: { summary: string; improvements: unknown },
  contact: PdfContact | null
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, report, contact)) as any);
}
