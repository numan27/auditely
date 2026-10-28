'use client';

// app/_shared/components/providers/siteAnalytics.tsx

// Vercel Web Analytics on every page: visits, where they came from, and the
// browser, device and country, with no cookies. Each address is cleaned first
// (lib/analytics/pageAddress.ts), so an account's search and request ids never leave the browser.

import { Analytics } from '@vercel/analytics/next';
import { withPrivateAddress } from '@/app/_shared/lib/analytics/pageAddress';

export function SiteAnalytics() {
  return <Analytics beforeSend={withPrivateAddress} />;
}
