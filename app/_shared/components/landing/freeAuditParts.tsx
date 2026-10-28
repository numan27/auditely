'use client';

// app/_shared/components/landing/freeAuditParts.tsx

// What the free audit shows once it's asked for: a note under the field, the
// minute while it runs, and the report with a way to keep it.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { GaugeIcon } from '@/app/_shared/components/ui/icons/icons';
import { FreeAuditReport } from '@/app/_shared/components/landing/freeAuditReport';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import { FREE_AUDIT_COPY, type FreeAuditView } from '@/app/_shared/lib/freeAudit/freeAuditCopy';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const TILES = ['Performance', 'SEO', 'Mobile', 'SSL', 'GEO', 'AEO', 'Lead capture'];

export const primary = [buttonStyles.button, buttonStyles['button--primary']].join(' ');
const signUpClasses = `${primary} min-h-11 whitespace-nowrap px-[18px] text-[15px]`;

const bareHost = (host: string) => host.replace(/^www\./, '');

export function SignUpLink() {
  return (
    <Link href={ROUTES.SIGNUP} className={signUpClasses}>
      Sign up free
    </Link>
  );
}

/** A line under the form: a note with the way to an account, or a warning to fix the address */
export function Message({ text, offer }: { text: string; offer: boolean }) {
  const warn = !offer;
  return (
    <div
      className={`grid grid-cols-[28px_1fr] items-center gap-x-3.5 gap-y-3 rounded-[14px] border px-[18px] py-4 min-[601px]:grid-cols-[28px_1fr_auto] ${
        warn
          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full ${
          warn ? 'bg-amber-200/70 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]'
        }`}
        aria-hidden
      >
        {warn ? <span className="text-sm font-bold leading-none">!</span> : <GaugeIcon size={15} aria-hidden />}
      </span>
      <p className="text-[15.5px] leading-normal text-[var(--color-text-primary)]">{text}</p>
      {offer && (
        <div className="col-start-2 min-[601px]:col-start-3">
          <SignUpLink />
        </div>
      )}
    </div>
  );
}

/** The bar creeps along for about a minute: there's no real progress to report */
function Progress() {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden>
      <span
        className="block h-full rounded-full bg-[var(--color-primary-600)] transition-[width] duration-[60000ms] ease-out motion-reduce:transition-none"
        style={{ width: started ? '92%' : '6%' }}
      />
    </div>
  );
}

export function Running({ host }: { host: string }) {
  return (
    <div className={`${cardClasses} p-5 min-[601px]:p-8`} role="status">
      <div className="flex items-center gap-3.5">
        <svg className="h-[22px] w-[22px] flex-none animate-spin text-[var(--color-primary-600)]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Auditing {bareHost(host)}</h2>
          <p className="mt-1 text-base text-[var(--color-text-secondary)]">This takes about a minute. Keep this tab open.</p>
        </div>
      </div>
      <Progress />
      <div className="mt-7 grid grid-cols-2 gap-3 min-[601px]:grid-cols-4 min-[961px]:grid-cols-7" aria-hidden>
        {TILES.map((label) => (
          <div key={label} className="flex h-[84px] flex-col justify-between rounded-xl bg-[var(--color-bg-primary)] p-3.5">
            <span className="h-[26px] w-12 animate-pulse rounded-md bg-[var(--color-border)]" />
            <small className="text-[12.5px] font-medium text-[var(--color-text-tertiary)]">{label}</small>
          </div>
        ))}
      </div>
      <div className="mt-7 flex flex-col gap-3" aria-hidden>
        {['100%', '92%', '64%'].map((width) => (
          <span key={width} className="h-3 animate-pulse rounded-md bg-[var(--color-border)]/60" style={{ width }} />
        ))}
      </div>
    </div>
  );
}

const auditedWhen = (result: FreeAuditView, again: boolean) =>
  again
    ? `Audited ${new Date(result.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Audited just now';

export function Result({ result, again }: { result: FreeAuditView; again: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[18px] bg-[#111726] px-5 py-5 text-white min-[601px]:px-7 min-[601px]:py-6 dark:border dark:border-[var(--color-border)] dark:bg-[var(--color-surface)]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white dark:text-[var(--color-text-primary)]">{FREE_AUDIT_COPY.keepTitle}</h2>
          <p className="mt-1.5 max-w-[560px] text-base leading-normal text-[#c9cedb] dark:text-[var(--color-text-secondary)]">
            {FREE_AUDIT_COPY.keepText}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <SignUpLink />
          <Link
            href={ROUTES.LOGIN}
            className={`${buttonStyles.button} min-h-11 border border-[#3a4256] px-[18px] text-[15px] text-white hover:border-[#5a6378] dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)]`}
          >
            Sign in
          </Link>
        </div>
      </div>
      <div className="mt-5">
        <FreeAuditReport
          name={result.host}
          website={result.website}
          audit={result.audit}
          report={result.report}
          badge={auditedWhen(result, again)}
        />
      </div>
      <p className="mt-6 text-[15px] text-[var(--color-text-secondary)]">{FREE_AUDIT_COPY.used}</p>
    </>
  );
}
