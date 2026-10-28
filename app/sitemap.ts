// app/sitemap.ts

// The public pages, once sign-ups are open; nothing before that (robots.ts keeps
// search engines out anyway).

import type { MetadataRoute } from 'next';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { AUDITELY_URL } from '@/app/_shared/lib/config/site';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!signupsOpen()) return [];
  return [ROUTES.HOME, ROUTES.TERMS, ROUTES.PRIVACY].map((path) => ({ url: `${AUDITELY_URL}${path}` }));
}
