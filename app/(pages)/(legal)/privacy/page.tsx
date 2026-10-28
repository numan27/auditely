import type { Metadata } from 'next';
import { PrivacyContent } from '@/app/_shared/components/legal/privacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Auditely collects, why, and what you can do about it.',
  // Unlinked for now (only the sign-up line links here), so out of search results
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
