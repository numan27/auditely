'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full p-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-[var(--color-primary-600)]">
          Next.js Template
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
