// The emailed sign-in link lands here (via /auth/callback). Opening it signs
// nobody in: email scanners (Outlook's Safe Links and others) open links before
// the person does, and would use up the one-time link. Continue posts the link's
// details back to the callback, from this site, and that signs in.

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@/app/_shared/components/ui/button/button';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export const metadata: Metadata = {
  title: 'Finish signing in',
  robots: { index: false, follow: false },
};

type Param = string | string[] | undefined;

interface ContinuePageProps {
  searchParams: Promise<{ token_hash?: Param; type?: Param; next?: Param; keep?: Param }>;
}

// A repeated query parameter arrives as a list; the first one counts
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

export default async function ContinuePage({ searchParams }: ContinuePageProps) {
  const query = await searchParams;
  const tokenHash = first(query.token_hash);
  if (!tokenHash || first(query.type) !== 'email') redirect(`${ROUTES.LOGIN}?error=link`);
  const next = first(query.next);
  const keep = first(query.keep);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Finish signing in
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Press Continue to sign in to Auditely in this browser.</p>
      </div>

      <form method="post" action={ROUTES.AUTH_CALLBACK}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value="email" />
        {next && <input type="hidden" name="next" value={next} />}
        {keep && <input type="hidden" name="keep" value={keep} />}
        <Button type="submit" variant="primary" size="lg" fullWidth>
          Continue
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        This step stops email security scanners from using up your link before you open it.
      </p>
    </div>
  );
}
