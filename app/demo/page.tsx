// app/demo/page.tsx

// The public demo: the workspace on the saved sample (see lib/demo/). Open to
// anyone; nothing on it calls the API.

import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import { DemoProvider } from '@/app/_shared/components/providers/DemoProvider';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';

export const metadata: Metadata = {
  title: 'Auditely demo',
  description: 'Find local businesses, audit their websites and draft the outreach email. A demo on saved sample data.',
};

export default async function DemoPage() {
  // Rendered per request, so DEMO_VIDEO_URL and DEMO_CONTACT_URL are read where the app runs, not where it was built
  await connection();

  return (
    <DemoProvider data={demoData} links={demoLinks()}>
      <Workspace />
    </DemoProvider>
  );
}
