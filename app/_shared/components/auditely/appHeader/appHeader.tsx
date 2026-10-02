// app/_shared/components/auditely/appHeader/appHeader.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { LogoutButton } from '@/app/_shared/components/auditely/logoutButton/logoutButton';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';

const NAV = [
  { href: ROUTES.HOME, label: 'Search', short: 'Search' },
  { href: ROUTES.SEARCHES, label: 'Saved searches', short: 'Saved' },
];

export function AppHeader() {
  const pathname = usePathname();
  const demo = useDemo();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
        <Link
          href={demo ? ROUTES.DEMO : ROUTES.HOME}
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <LogoMark />
          <span className="hidden sm:inline">Auditely</span>
        </Link>

        {demo ? (
          <span className="rounded-full bg-[var(--color-primary-600)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-600)]">
            Demo
          </span>
        ) : (
          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    active
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {demo ? (
            <Link
              href={ROUTES.LOGIN}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Sign in
            </Link>
          ) : (
            <LogoutButton />
          )}
        </div>
      </div>
    </header>
  );
}
