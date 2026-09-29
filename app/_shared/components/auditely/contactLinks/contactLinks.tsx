// app/_shared/components/auditely/contactLinks/contactLinks.tsx

// Ways to reach a business besides email: its contact page and social profiles.

import type { ReactNode } from 'react';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';

interface ContactLinksProps {
  contactPage: string | null;
  socials: Socials | null;
}

const ICON_PROPS = { width: 12, height: 12, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

const FormIcon = () => (
  <svg {...ICON_PROPS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);

const FacebookIcon = () => (
  <svg {...ICON_PROPS} fill="currentColor">
    <path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z" />
  </svg>
);

const InstagramIcon = () => (
  <svg {...ICON_PROPS} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const LinkedInIcon = () => (
  <svg {...ICON_PROPS} fill="currentColor">
    <path d="M4 9h4v11H4zM6 3.5a2 2 0 110 4 2 2 0 010-4zM10 9h3.8v1.6c.6-1 1.9-1.9 3.8-1.9 3.6 0 4.4 2.3 4.4 5.4V20h-4v-5.2c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20h-4z" />
  </svg>
);

export function ContactLinks({ contactPage, socials }: ContactLinksProps) {
  const links: { label: string; href: string; icon: ReactNode }[] = [];
  if (contactPage) links.push({ label: 'Contact form', href: contactPage, icon: <FormIcon /> });
  if (socials?.facebook) links.push({ label: 'Facebook', href: socials.facebook, icon: <FacebookIcon /> });
  if (socials?.instagram) links.push({ label: 'Instagram', href: socials.instagram, icon: <InstagramIcon /> });
  if (socials?.linkedin) links.push({ label: 'LinkedIn', href: socials.linkedin, icon: <LinkedInIcon /> });

  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-bg-secondary)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          {link.icon}
          {link.label}
        </a>
      ))}
    </div>
  );
}
