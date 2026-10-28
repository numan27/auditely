import type { Metadata } from 'next';
import { TermsContent } from '@/app/_shared/components/legal/termsContent';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using Auditely.',
  // Unlinked for now (only the sign-up line links here), so out of search results
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return <TermsContent />;
}
