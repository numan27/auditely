import Link from 'next/link';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const startClasses = [buttonStyles.button, buttonStyles['button--primary'], buttonStyles['button--md'], 'whitespace-nowrap'].join(' ');
const linkClasses =
  'whitespace-nowrap rounded-lg px-3 py-3 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

/** The logo, home: the sign-in pages' top bar has it too */
export function LandingLogo() {
  return (
    <Link
      href={ROUTES.HOME}
      className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-[var(--color-text-primary)]"
    >
      <LogoMark size={28} />
      Auditely
    </Link>
  );
}

// The landing page's, and the Terms', Privacy's and Contact's, top bar. It stays at the top
// as the page scrolls. The page's own sections hide below 960px; signing in and
// starting free never do.
const SECTIONS = [
  { hash: 'demo', label: 'Demo' },
  { hash: 'how', label: 'How it works' },
  { hash: 'pricing', label: 'Pricing' },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-md">
      <div className={`flex h-[72px] items-center justify-between gap-4 ${wrapClasses}`}>
        <LandingLogo />
        <nav aria-label="Main" className="flex items-center gap-1">
          {SECTIONS.map(({ hash, label }) => (
            <a key={hash} href={`${ROUTES.HOME}#${hash}`} className={`${linkClasses} hidden min-[961px]:inline-block`}>
              {label}
            </a>
          ))}
          <Link href={ROUTES.LOGIN} className={linkClasses}>
            Sign in
          </Link>
          <Link href={ROUTES.SIGNUP} className={startClasses}>
            Start free
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
