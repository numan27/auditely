import type { Metadata } from 'next';
import { TermsContent } from '@/app/_shared/components/legal/termsContent';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using Auditely.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <TermsContent />;
}
