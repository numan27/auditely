// app/_shared/components/auditely/appHeader/appHeader.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GearIcon } from '@/app/_shared/components/ui/icons/icons';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { LogoutButton } from '@/app/_shared/components/auditely/logoutButton/logoutButton';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { parseWorkspacePath } from '@/app/_shared/lib/utils/workspacePath';
import { NotificationBell } from '@/app/_shared/components/auditely/notificationBell/notificationBell';
import { UsageMeter } from '@/app/_shared/components/auditely/usageMeter/usageMeter';

// On a phone Settings is a gear, so the header fits at 360px
const NAV: { href: string; label: string; short: string; icon?: typeof GearIcon }[] = [
  { href: ROUTES.HOME, label: 'Search', short: 'Search' },
  { href: ROUTES.SEARCHES, label: 'Saved searches', short: 'Saved' },
  { href: ROUTES.SETTINGS, label: 'Settings', short: 'Settings', icon: GearIcon },
];

export function AppHeader() {
  const pathname = usePathname();
  const demo = useDemo();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-8 sm:px-6">
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
          <nav className="flex items-center gap-0.5 text-sm sm:gap-1" aria-label="Main">
            {NAV.map((item) => {
              // "Search" is every workspace view: its tabs, a saved search, a request
              const active = item.href === ROUTES.HOME ? !!parseWorkspacePath(pathname) : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-md px-2 py-1.5 font-medium transition-colors sm:px-2.5 ${
                    active
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {item.icon ? (
                    <span className="inline-flex h-5 items-center sm:hidden">
                      <item.icon size={16} />
                      <span className="sr-only">{item.short}</span>
                    </span>
                  ) : (
                    <span className="sm:hidden">{item.short}</span>
                  )}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {/* The demo has no allowances, requests or saved runs to hear about */}
          {!demo && <UsageMeter />}
          {!demo && <NotificationBell />}
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
