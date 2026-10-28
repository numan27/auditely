import Link from 'next/link';
import { LogoMark } from '@/app/_shared/components/auditely/logoMark/logoMark';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const linkClasses = 'px-2.5 py-3 text-[14.5px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

// The landing page's, and the Terms', Privacy's and Contact's, footer. Terms and
// Privacy are unlinked for now; the sign-up line (consentLine.tsx) still links them.
export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className={`${wrapClasses} flex flex-wrap items-center justify-between gap-4 pb-11 pt-7`}>
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <LogoMark size={22} />
          Auditely
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-1">
          {/* <Link href={ROUTES.TERMS} className={linkClasses}>
            Terms
          </Link>
          <Link href={ROUTES.PRIVACY} className={linkClasses}>
            Privacy
          </Link> */}
          <Link href={ROUTES.CONTACT} className={linkClasses}>
            Contact
          </Link>
        </nav>
        <p className="text-sm text-[var(--color-text-tertiary)]">© {new Date().getFullYear()} Auditely</p>
      </div>
    </footer>
  );
}
