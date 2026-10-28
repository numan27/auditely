import type { Metadata } from 'next';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import { LandingPage } from '@/app/_shared/components/landing/landingPage';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';
import { freeAuditSetup } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { SEO_FILES } from '@/app/_shared/lib/config/routes';
import { SHARE_DESCRIPTION, SHARE_IMAGE_ALT, SHARE_TITLE } from '@/app/_shared/lib/seo/shareCopy';
import { getSession } from '@/app/_shared/lib/supabase/server';

// Signed out, this is the landing page; the proxy only lets a signed-out visitor
// through once sign-ups are open
export const metadata: Metadata = {
  title: { absolute: SHARE_TITLE },
  description: SHARE_DESCRIPTION,
  // The root layout's, with the landing page's title. A child's openGraph replaces its
  // parent's, the share image (app/opengraph-image.tsx) included, so it's named here.
  openGraph: {
    type: 'website',
    siteName: 'Auditely',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: '/',
    images: [{ url: SEO_FILES.SHARE_IMAGE, width: 1200, height: 630, alt: SHARE_IMAGE_ALT }],
  },
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    const { videoUrl, videoPlayerUrl } = demoLinks();
    const video = videoUrl ? { url: videoUrl, playerUrl: videoPlayerUrl } : null;
    return <LandingPage freeAuditOn={freeAuditSetup().state === 'on'} video={video} />;
  }
  return <Workspace />;
}
