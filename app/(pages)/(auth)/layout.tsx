'use client';

import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { LandingLogo } from '@/app/_shared/components/landing/landingHeader';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      {/* The landing page's logo, in its column, so it stays put from the home page to here */}
      <header className="border-b border-[var(--color-border)]">
        <div className={`flex h-[72px] items-center justify-between gap-4 ${wrapClasses}`}>
          <LandingLogo />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-md sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
