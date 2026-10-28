// app/_shared/components/auditely/businessEmail/businessEmail.tsx

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ContactLine } from '@/app/_shared/components/auditely/contactLine/contactLine';
import { CheckIcon, CopyIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { checkMark, type CheckMark, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { exhausted, readLimit } from '@/app/_shared/lib/usage/plans';
import { copyText } from '@/app/_shared/lib/utils/browserExport';

interface BusinessEmailProps {
  email: string | null;
  website: string | null;
  businessId: string;
  /** What Verifalia said about this address, once "Send email" has checked it */
  check?: EmailCheck | null;
  onFound: (email: string) => void;
}

const MARK_TONES: Record<CheckMark['tone'], string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

/**
 * Email row for a business card. Controlled: the parent owns the canonical
 * email value. When no email is known yet, offers an on-demand "Find email"
 * action that runs the full discovery cascade (including Hunter) for this one
 * business — the only path allowed to spend API quota. Once the plan's email
 * lookups have run out it asks first, and can search the website alone.
 * Beside a known email: what Verifalia said about it, once it was checked.
 */
export function BusinessEmail({ email, website, businessId, check, onFound }: BusinessEmailProps) {
  const demo = useDemo();
  const usage = useUsage();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [finding, setFinding] = useState(false);
  // After a search with no email: whether the plan kept it to the website
  const [notFound, setNotFound] = useState<{ limited: boolean } | null>(null);
  const mark = check ? checkMark(check) : null;

  const copyEmail = async () => {
    if (!email) return;
    // The browser can refuse (permission, or the page wasn't focused): then it says so
    const done = await copyText(email);
    setCopy(done ? 'copied' : 'failed');
    setTimeout(() => setCopy('idle'), done ? 2000 : 6000);
  };

  const search = async (apiFallback: boolean) => {
    setFinding(true);
    setNotFound(null);
    try {
      const res = await fetch(API_ROUTES.FIND_EMAILS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_ids: [businessId], apiFallback }),
      });
      const data = await res.json();
      const found: string | null = data.results?.[0]?.email ?? null;
      if (found) onFound(found);
      else setNotFound({ limited: readLimit(data) !== null });
    } catch {
      setNotFound({ limited: false });
    } finally {
      setFinding(false);
      usage?.refresh();
    }
  };

  const handleFind = () => {
    if (demo) return demo.restrict('findEmail');
    const limit = usage?.summary ? exhausted(usage.summary, 'email_lookup') : null;
    if (limit && usage) {
      return usage.promptUpgrade({ limit, continueLabel: 'Search the website only', onContinue: () => void search(false) });
    }
    void search(true);
  };

  // The demo's emails are masked: nothing to write to or copy
  if (email && demo) {
    return (
      <ContactLine icon={<MailIcon size={14} />}>
        <span className="font-medium text-[var(--color-text-primary)]">{email}</span>
      </ContactLine>
    );
  }

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
            title={copy === 'copied' ? 'Copied' : 'Copy email'}
            aria-label={copy === 'copied' ? 'Email copied' : 'Copy email'}
            className="cursor-pointer rounded p-0.5 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {copy === 'copied' ? <CheckIcon size={13} className="text-emerald-500" /> : <CopyIcon size={13} />}
          </button>
          {copy === 'failed' && (
            <span role="status" className="text-xs text-red-600 dark:text-red-400">
              Couldn&apos;t copy. Select the address instead.
            </span>
          )}
          {/* The word, not just a tick: the copy button beside it turns into a tick too */}
          {mark && (
            <span title={mark.title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${MARK_TONES[mark.tone]}`}>
              {mark.tone === 'good' && <CheckIcon size={11} strokeWidth={3} />}
              {mark.label}
            </span>
          )}
        </span>
      </ContactLine>
    );
  }

  // No email yet — offer discovery only if there's a domain to search.
  if (!website) return null;

  // The website had none, and the plan doesn't search the email databases (or they ran out)
  if (notFound?.limited) {
    return (
      <ContactLine icon={<MailIcon size={14} />}>
        <span className="inline-flex items-center gap-1.5">
          <span>No email on its website</span>
          <Link href={ROUTES.PLANS} className="font-medium text-[var(--color-primary-600)] hover:underline">
            See plans
          </Link>
        </span>
      </ContactLine>
    );
  }

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
