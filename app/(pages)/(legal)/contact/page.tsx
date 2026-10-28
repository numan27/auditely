import type { Metadata } from 'next';
import { ContactForm } from '@/app/_shared/components/contact/contactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Send the Auditely team a message.',
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <article>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">Contact us</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Questions about Auditely or the beta? Send us a message and we&apos;ll reply by email.
        </p>
      </header>
      <ContactForm />
    </article>
  );
}
