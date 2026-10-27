// app/_shared/lib/audit/pdfRender.ts

// Draws an audit's PDF report from data already in hand. No database: the
// download and the report link look the audit up first (auditPdf.ts), the
// public demo passes its saved sample. Server-only.

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { PdfDocument, type PdfDocumentProps } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, buildUpworkPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import type { PdfVariant } from '@/app/_shared/lib/types/auditely';

export interface PdfBusiness {
  name: string;
  website: string | null;
  address: string;
  phone: string | null;
}

type PdfReport = { summary: string; improvements: unknown };

export const pdfFileName = (businessName: string, variant: PdfVariant = 'full'): string => {
  const name = variant === 'upwork' ? `${businessName} upwork` : businessName;
  return `audit-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-')}.pdf`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const draw = (props: PdfDocumentProps): Promise<Buffer> => renderToBuffer(createElement(PdfDocument, props) as any);

/** In the account's brand; a brand without a contact leaves out the "next step" box */
export function renderPdf(audit: AuditLike, business: PdfBusiness, report: PdfReport, brand: Brand): Promise<Buffer> {
  return draw(buildPdfProps(audit, business, report, brand));
}

/** The report to attach on Upwork: no contact details and nothing to click */
export function renderUpworkPdf(audit: AuditLike, business: PdfBusiness, report: PdfReport, brand: Brand): Promise<Buffer> {
  return draw(buildUpworkPdfProps(audit, business, report, brand));
}
