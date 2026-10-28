import type { Metadata } from 'next';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import { getSession } from '@/app/_shared/lib/supabase/server';
// import { LandingPage } from '@/app/_shared/components/landing/landingPage/landingPage';

// Signed out, this is the landing page; the proxy only lets a signed-out visitor
// through once sign-ups are open
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const session = await getSession();
  // The landing page arrives with the landing components
  if (!session) return null; // <LandingPage />
  return <Workspace />;
}
