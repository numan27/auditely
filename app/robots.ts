// app/robots.ts

// What search engines may read: nothing while Auditely is invite-only; once sign-ups
// open, the public pages and none of the app behind the sign-in. Read on each request,
// so it always agrees with the proxy.

import type { MetadataRoute } from 'next';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { AUDITELY_URL } from '@/app/_shared/lib/config/site';
import { ROUTES, SEO_FILES } from '@/app/_shared/lib/config/routes';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!signupsOpen()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      // Terms and Privacy aren't listed while they're unlinked; their pages say noindex
      allow: [ROUTES.HOME, ROUTES.CONTACT, ROUTES.DEMO],
      disallow: [
        '/api/',
        '/auth/',
        `${ROUTES.REPORT}/`,
        ROUTES.SEARCH,
        ROUTES.SEARCHES,
        ROUTES.AUDIT,
        ROUTES.REQUESTS,
        ROUTES.PLANS,
        ROUTES.SETTINGS,
      ],
    },
    sitemap: `${AUDITELY_URL}${SEO_FILES.SITEMAP}`,
  };
}
