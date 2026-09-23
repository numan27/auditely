'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full p-4 flex justify-between items-center">
        <Link href={ROUTES.HOME} className="text-2xl font-bold text-[var(--color-primary-600)]">
          Auditely
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
    </div>
  );
}
