import Link from 'next/link';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const linkClasses = 'underline underline-offset-2 hover:text-[var(--color-text-primary)]';

// Under the sign-in and sign-up forms: continuing is agreeing
export function ConsentLine() {
  return (
    <p className="text-xs text-[var(--color-text-secondary)]">
      By continuing, you agree to Auditely&apos;s{' '}
      <Link href={ROUTES.TERMS} className={linkClasses}>
        Terms
      </Link>{' '}
      and{' '}
      <Link href={ROUTES.PRIVACY} className={linkClasses}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
