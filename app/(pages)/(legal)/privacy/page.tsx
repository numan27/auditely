import type { Metadata } from 'next';
import { PrivacyContent } from '@/app/_shared/components/legal/privacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Auditely collects, why, and what you can do about it.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
