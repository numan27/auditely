// app/_shared/components/auditely/billing/billingButton.tsx

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { openBilling } from '@/app/_shared/components/auditely/billing/billingRequest';

/**
 * Opens Checkout or the billing portal. It stays busy until the browser leaves,
 * so a second click can't open a second Checkout; a failure shows under it.
 */
export function BillingButton({
  label,
  url,
  body,
  variant = 'primary',
  fullWidth = false,
}: {
  label: string;
  url: string;
  body: unknown;
  variant?: 'primary' | 'outline';
  /** Fills a plan column; in Settings it sits at its label's width */
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from Stripe, the browser may restore this page as it was left: busy
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => event.persisted && setBusy(false);
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  async function open() {
    setBusy(true);
    setError(null);
    const answer = await openBilling(url, body);
    if (answer.ok) {
      window.location.assign(answer.url);
      return;
    }
    setError(answer.error);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} isLoading={busy} onClick={open} fullWidth={fullWidth}>
        {label}
      </Button>
      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
