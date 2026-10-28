'use client';

// app/_shared/components/landing/closingBand.tsx

// The last ask, on an ink band. With free audits on, its field hands the website
// to the hero's (FREE_AUDIT_EVENT), which scrolls up and runs it there; with them
// off, it's a way to sign up.

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import motion from '@/app/_shared/components/landing/landingMotion.module.scss';
import { FREE_AUDIT_EVENT } from '@/app/_shared/components/landing/freeAuditFlow';
import { FREE_PLAN_LINE } from '@/app/_shared/components/landing/freeAuditHero';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const bandClasses =
  'relative overflow-hidden rounded-[28px] border border-[#1a2136] bg-[#0f1424] px-6 py-12 min-[601px]:px-12 min-[601px]:py-16 dark:border-[var(--color-border)] dark:bg-[var(--color-surface)]';
const whiteButton = `${buttonStyles.button} min-h-[52px] bg-white px-[22px] text-base font-semibold text-[#111726] hover:bg-[#e8ecf7]`;

export function ClosingBand({ enabled }: { enabled: boolean }) {
  const [website, setWebsite] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent(FREE_AUDIT_EVENT, { detail: website }));
  };

  return (
    <section aria-labelledby="closing-heading" className="bg-[var(--color-bg-primary)] pb-24 pt-6">
      <div className={wrapClasses}>
        <div className={bandClasses}>
          <span className={motion.dotsInk} aria-hidden />
          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div>
              <h2 id="closing-heading" className="font-display text-[34px] font-bold leading-[1.05] tracking-tight text-white min-[601px]:text-[44px] dark:text-[var(--color-text-primary)]">
                Try it on a site you know.
              </h2>
              <p className="mt-3 text-lg text-[#b9c1d6] dark:text-[var(--color-text-secondary)]">
                {enabled ? 'Your first audit is free, with no sign-up.' : `${FREE_PLAN_LINE}. No card needed.`}
              </p>
            </div>
            {enabled ? (
              <form
                onSubmit={submit}
                noValidate
                className="flex max-w-[520px] flex-[1_1_380px] flex-wrap gap-2.5 rounded-2xl border border-white/15 bg-white/[.08] p-2 focus-within:ring-2 focus-within:ring-white/40 dark:focus-within:ring-[var(--color-primary-600)]/40 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]"
              >
                <label htmlFor="closing-site" className="sr-only">
                  Website to audit
                </label>
                <input
                  id="closing-site"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="yourclient.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-[52px] min-w-0 flex-[1_1_200px] rounded-xl border-0 bg-transparent px-3.5 text-[17px] text-white placeholder:text-[#8a93ab] focus:outline-none dark:text-[var(--color-text-primary)]"
                />
                <button type="submit" className={`${whiteButton} flex-[1_0_auto] min-[481px]:flex-none`}>
                  Audit it free
                </button>
              </form>
            ) : (
              <Link href={ROUTES.SIGNUP} className={whiteButton}>
                Sign up free
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
