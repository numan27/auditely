// app/_shared/components/auditely/businessEmail/businessEmail.tsx

'use client';

import { useState } from 'react';
import { ContactLine } from '@/app/_shared/components/auditely/contactLine/contactLine';
import { CheckIcon, CopyIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

interface BusinessEmailProps {
  email: string | null;
  website: string | null;
  businessId: string;
  onFound: (email: string) => void;
}

/**
 * Email row for a business card. Controlled: the parent owns the canonical
 * email value. When no email is known yet, offers an on-demand "Find email"
 * action that runs the full discovery cascade (including Hunter) for this one
 * business — the only path allowed to spend API quota.
 */
export function BusinessEmail({ email, website, businessId, onFound }: BusinessEmailProps) {
  const [copied, setCopied] = useState(false);
  const [finding, setFinding] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const copyEmail = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFind = async () => {
    setFinding(true);
    setNotFound(false);
    try {
      const res = await fetch(API_ROUTES.FIND_EMAILS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_ids: [businessId], apiFallback: true }),
      });
      const data = await res.json();
      const found: string | null = data.results?.[0]?.email ?? null;
      if (found) onFound(found);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setFinding(false);
    }
  };

  if (email) {
    return (
      <ContactLine icon={<MailIcon size={14} />}>
        <span className="inline-flex items-center gap-1.5">
          <a href={`mailto:${email}`} className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary-600)] hover:underline">
            {email}
          </a>
          <button
            type="button"
            onClick={copyEmail}
            title={copied ? 'Copied' : 'Copy email'}
            aria-label={copied ? 'Email copied' : 'Copy email'}
            className="cursor-pointer rounded p-0.5 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {copied ? <CheckIcon size={13} className="text-emerald-500" /> : <CopyIcon size={13} />}
          </button>
        </span>
      </ContactLine>
    );
  }

  // No email yet — offer discovery only if there's a domain to search.
  if (!website) return null;

  return (
    <ContactLine icon={<MailIcon size={14} />}>
      <button
        type="button"
        onClick={handleFind}
        disabled={finding}
        className="cursor-pointer font-medium text-[var(--color-primary-600)] hover:underline disabled:cursor-default disabled:opacity-60"
      >
        {finding ? 'Finding email…' : notFound ? 'No email found. Try again' : 'Find email'}
      </button>
    </ContactLine>
  );
}
