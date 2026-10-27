// app/demo/report/[auditId]/route.ts

// The PDF reports of the public demo's sample audits. Built ahead, at build
// time, from the saved sample: no database, and nothing to pay per download.
// Any id that isn't a sample audit is a 404.

import { pdfFileName, renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import { reportContact } from '@/app/_shared/lib/config/reportContact';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples } from '@/app/_shared/lib/demo/demoSamples';

export const dynamic = 'force-static';
export const dynamicParams = false;

const samples = allSamples(demoData).filter((b) => b.audit && b.ai_report);

export function generateStaticParams() {
  return samples.map((b) => ({ auditId: b.audit!.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const business = samples.find((b) => b.audit?.id === auditId);
  if (!business?.audit || !business.ai_report) return new Response('Report not found', { status: 404 });

  // The owner's report as it was before profiles. The contact is off by default:
  // Upwork restricts sharing contact details before a contract.
  const contact = process.env.DEMO_PDF_CONTACT === '1' ? reportContact() : null;
  const brand = { ...resolveBrand({ profile: null, isOwner: true, plan: 'owner' }), contact };
  const pdf = await renderPdf(business.audit, business, business.ai_report, brand);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFileName(business.name)}"`,
      // The page's robots tag doesn't cover a PDF
      'X-Robots-Tag': 'noindex',
    },
  });
}
