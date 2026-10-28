// app/(pages)/(legal)/layout.tsx

// The Terms and the Privacy Policy: the landing page's header and footer around
// one readable column.

import type { ReactNode } from 'react';
import { LandingHeader } from '@/app/_shared/components/landing/landingHeader';
import { LandingFooter } from '@/app/_shared/components/landing/landingFooter';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <LandingHeader />
      <main className="flex-1 px-4 py-12 min-[601px]:py-16">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </main>
      <LandingFooter />
    </div>
  );
}
