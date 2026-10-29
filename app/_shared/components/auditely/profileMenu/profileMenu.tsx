// app/_shared/components/auditely/profileMenu/profileMenu.tsx

'use client';

// The header's profile menu: the signed-in person's logo (or initials) opens their
// name, company, email and plan, with the way to edit the profile in Settings, see
// the plans, send feedback and log out. Without a card it falls back to the account's email.

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';
import { LogoutButton } from '@/app/_shared/components/auditely/logoutButton/logoutButton';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { useAccount } from '@/app/_shared/lib/hooks/useAccount';
import { useConnections } from '@/app/_shared/lib/hooks/useConnections';
import { useLogout } from '@/app/_shared/lib/hooks/useLogout';
import { useProfileCard, type ProfileCard } from '@/app/_shared/lib/hooks/useProfileCard';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { PLANS, planHas } from '@/app/_shared/lib/usage/plans';

const firstLetter = (word: string) => (Array.from(word)[0] ?? '').toUpperCase();

/** "NK" for Numan Khalil; the company's when there's no name, the email's first letter without either */
export function initialsOf(card: ProfileCard): string {
  const words = (card.name?.trim() || card.company?.trim() || '').split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map(firstLetter).join('');
  return firstLetter(card.email.trim()) || '?';
}

/** Who the menu names: the person, else the company, else the email */
const titleOf = (card: ProfileCard) => card.name?.trim() || card.company?.trim() || card.email;

/** The saved logo, or the initials when there's none or it won't load */
export function Avatar({ card, size }: { card: ProfileCard; size: number }) {
  const [broken, setBroken] = useState(false);
  const box = 'grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-border)]';
  if (card.logo && !broken) {
    return (
      <span className={`${box} bg-white`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.logo} alt="" width={size} height={size} onError={() => setBroken(true)} className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`${box} bg-[var(--color-primary-600)]/10 font-semibold text-[var(--color-primary-600)]`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(card)}
    </span>
  );
}

const itemClasses =
  'block w-full cursor-pointer px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:bg-[var(--color-bg-secondary)] focus-visible:outline-none';

interface ProfilePanelProps {
  card: ProfileCard;
  /** The plan's name, or null when the usage couldn't be read */
  planName: string | null;
  /** The plan puts the person's name and logo on reports, so there's a profile to edit */
  branding: boolean;
  onClose: () => void;
  onLogout: () => void;
  onFeedback: () => void;
}

/** The menu's dropdown: who is signed in, then Edit profile (on a plan with branding), Plans and usage, Send feedback, and Log out */
export function ProfilePanel({ card, planName, branding, onClose, onLogout, onFeedback }: ProfilePanelProps) {
  const title = titleOf(card);
  const company = card.name?.trim() && card.company?.trim() ? card.company : null;
  const blank = branding && !card.name?.trim() && !card.company?.trim() && !card.logo;
  return (
    <>
      <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-4">
        <Avatar card={card} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          {company && <p className="truncate text-sm text-[var(--color-text-secondary)]">{company}</p>}
          {title !== card.email && <p className="truncate text-sm text-[var(--color-text-tertiary)]">{card.email}</p>}
          {planName && <p className="mt-1 text-xs font-medium text-[var(--color-primary-600)]">{planName} plan</p>}
        </div>
      </div>
      {blank && (
        <p className="border-b border-[var(--color-border)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
          Add your name and logo in Settings to sign your reports and emails.
        </p>
      )}
      <div className="py-1">
        {branding && (
          <Link href={`${ROUTES.SETTINGS}#profile`} onClick={onClose} className={itemClasses}>Edit profile</Link>
        )}
        <Link href={ROUTES.PLANS} onClick={onClose} className={itemClasses}>Plans and usage</Link>
        <button type="button" onClick={onFeedback} className={itemClasses}>Send feedback</button>
      </div>
      <div className="border-t border-[var(--color-border)] py-1">
        <button type="button" onClick={onLogout} className={itemClasses}>Log out</button>
      </div>
    </>
  );
}

/** The header's avatar button and its dropdown */
export function ProfileMenu() {
  const saved = useProfileCard();
  const account = useAccount();
  const plan = useConnections()?.plan;
  const summary = useUsage()?.summary;
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const card = saved ?? (account ? { name: null, company: null, email: account.email, logo: null } : null);
  if (!card) return <LogoutButton />;

  const label = `Your account: ${titleOf(card)}`;
  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-600)]"
      >
        <Avatar card={card} size={30} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Your account"
          className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
        >
          <ProfilePanel
            card={card}
            planName={summary ? PLANS[summary.plan].name : null}
            branding={!!plan && planHas(plan, 'branding')}
            onClose={() => setOpen(false)}
            onLogout={logout}
            onFeedback={() => {
              setOpen(false);
              setFeedback(true);
            }}
          />
        </div>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}
