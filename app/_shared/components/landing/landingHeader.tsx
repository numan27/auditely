import Link from 'next/link';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const startClasses = [buttonStyles.button, buttonStyles['button--primary'], buttonStyles['button--md']].join(' ');
const linkClasses =
  'rounded-lg px-3 py-3 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

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

// The landing page's, and the Terms' and Privacy's, top bar. The page's own
// sections hide below 600px; signing in and starting free never do.
export function LandingHeader() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className={`flex h-[72px] items-center justify-between gap-4 ${wrapClasses}`}>
        <LandingLogo />
        <nav aria-label="Main" className="flex items-center gap-1">
          <a href={`${ROUTES.HOME}#sample`} className={`${linkClasses} hidden min-[601px]:inline-block`}>
            Sample report
          </a>
          <a href={`${ROUTES.HOME}#pricing`} className={`${linkClasses} hidden min-[601px]:inline-block`}>
            Pricing
          </a>
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
