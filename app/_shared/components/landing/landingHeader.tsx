import Link from 'next/link';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const startClasses = [buttonStyles.button, buttonStyles['button--primary'], buttonStyles['button--md']].join(' ');
const linkClasses =
  'rounded-lg px-3 py-3 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

// The landing page's, and the Terms' and Privacy's, top bar. The page's own
// sections hide below 600px; signing in and starting free never do.
export function LandingHeader() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between gap-4 px-4 min-[601px]:px-10">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <LogoMark size={28} />
          Auditely
        </Link>
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
