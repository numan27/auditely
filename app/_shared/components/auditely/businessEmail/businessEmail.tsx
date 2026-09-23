// app/_shared/components/auditely/businessEmail/businessEmail.tsx

'use client';

import { useState } from 'react';

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
      const res = await fetch('/api/find-emails', {
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
      <div className="flex items-center gap-1.5 mt-0.5">
        <a
          href={`mailto:${email}`}
          className="text-sm text-[var(--color-primary-600)] hover:underline"
        >
          {email}
        </a>
        <button
          onClick={copyEmail}
          title="Copy email"
          className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // No email yet — offer discovery only if there's a domain to search.
  if (!website) return null;

  return (
    <div className="mt-0.5">
      <button
        onClick={handleFind}
        disabled={finding}
        className="cursor-pointer text-sm text-[var(--color-primary-600)] hover:underline disabled:opacity-60 disabled:cursor-default"
      >
        {finding ? 'Finding email…' : notFound ? 'No email found — try again' : 'Find email'}
      </button>
    </div>
  );
}
