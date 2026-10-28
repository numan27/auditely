// app/_shared/components/landing/sampleReport.tsx

// "What you get back": a real report from the demo's search, exactly as
// Auditely wrote it. Server-only: the sample comes from the demo data.

import Link from 'next/link';
import { FreeAuditReport } from '@/app/_shared/components/landing/freeAuditReport';
import { sampleReportData } from '@/app/_shared/lib/demo/demoData';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export function SampleReport() {
  const sample = sampleReportData();
  return (
    <FreeAuditReport
      {...sample}
      badge="Sample report"
      pill
      footer={
        <Link href={ROUTES.DEMO} className="font-medium text-[var(--color-primary-600)] hover:underline">
          See the sample search this came from
        </Link>
      }
    />
  );
}
