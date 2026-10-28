// app/demo/report/[auditId]/route.ts

// The PDF reports of the public demo's sample audits. Built ahead, at build
// time, from the saved sample: no database, and nothing to pay per download.
// Any id that isn't a sample audit is a 404.

import { pdfFileName, renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
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

  // As an account without a brand of its own sends it: Auditely's name, no contact
  // box, and nothing of the owner's. The landing page links here.
  const brand = resolveBrand({ profile: null, isOwner: false, plan: 'free' });
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
