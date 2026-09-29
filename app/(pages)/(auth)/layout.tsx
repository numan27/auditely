'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      <header className="flex w-full items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <LogoMark />
          Auditely
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-md sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
