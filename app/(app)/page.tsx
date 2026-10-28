import type { Metadata } from 'next';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import { LandingPage } from '@/app/_shared/components/landing/landingPage';
import { freeAuditSetup } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { getSession } from '@/app/_shared/lib/supabase/server';

// Signed out, this is the landing page; the proxy only lets a signed-out visitor
// through once sign-ups are open
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <LandingPage freeAuditOn={freeAuditSetup().state === 'on'} />;
  return <Workspace />;
}
