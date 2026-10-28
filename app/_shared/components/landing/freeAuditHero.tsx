'use client';

// app/_shared/components/landing/freeAuditHero.tsx

// The landing page's first screen: what Auditely does and one field to try it.
// The free audit runs here, without an account. While it runs and once it's
// back, the headline shrinks and the band below shows the progress, then the
// report with a way to keep it.

import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { GaugeIcon } from '@/app/_shared/components/ui/icons/icons';
import { FreeAuditReport } from '@/app/_shared/components/landing/freeAuditReport';
import { cardClasses, wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { freeAuditStep, signUpOffered, type FreeAuditState } from '@/app/_shared/components/landing/freeAuditFlow';
import { FREE_AUDIT_COPY, type FreeAuditResponse, type FreeAuditView } from '@/app/_shared/lib/freeAudit/freeAuditCopy';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { normalizeWebsiteUrl } from '@/app/_shared/lib/utils/websiteUrl';

const TILES = ['Performance', 'SEO', 'Mobile', 'SSL', 'GEO', 'AEO', 'Lead capture'];

const primary = [buttonStyles.button, buttonStyles['button--primary']].join(' ');
const signUpClasses = `${primary} min-h-11 whitespace-nowrap px-[18px] text-[15px]`;

const bareHost = (host: string) => host.replace(/^www\./, '');

function SignUpLink() {
  return (
    <Link href={ROUTES.SIGNUP} className={signUpClasses}>
      Sign up free
    </Link>
  );
}

/** A line under the form: a note with the way to an account, or a warning to fix the address */
function Message({ text, offer }: { text: string; offer: boolean }) {
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

function Running({ host }: { host: string }) {
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

function Result({ result, again }: { result: FreeAuditView; again: boolean }) {
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

async function post(website: string): Promise<FreeAuditResponse | null> {
  const res = await fetch(API_ROUTES.FREE_AUDIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ website }),
  });
  const body = await res.json().catch(() => null);
  return body && typeof body.ok === 'boolean' ? (body as FreeAuditResponse) : null;
}

/** What shows under the form: a refusal, the previous audit's note, or that the free one is used */
function note(state: FreeAuditState): string | null {
  if (state.kind === 'refused') return state.message;
  if (state.kind === 'done' && state.resubmitted) return FREE_AUDIT_COPY.used;
  if (state.kind === 'done' && state.again) return FREE_AUDIT_COPY.again;
  return null;
}

export function FreeAuditHero({ enabled }: { enabled: boolean }) {
  const [state, dispatch] = useReducer(freeAuditStep, { kind: 'idle' } as FreeAuditState);
  const [website, setWebsite] = useState('');
  const noteRef = useRef<HTMLDivElement>(null);
  const running = state.kind === 'running';
  const compact = state.kind !== 'idle';
  const message = note(state);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    // One free audit: a second ask while the result shows says so, and sends nothing
    if (state.kind === 'done') {
      dispatch({ type: 'submit', host: '' });
      noteRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const parsed = normalizeWebsiteUrl(website);
    if (!parsed.ok) {
      dispatch({ type: 'answer', response: { ok: false, reason: 'invalid', error: parsed.error } });
      return;
    }
    dispatch({ type: 'submit', host: parsed.host });
    try {
      const response = await post(parsed.url);
      dispatch(response ? { type: 'answer', response } : { type: 'networkError' });
    } catch {
      dispatch({ type: 'networkError' });
    }
  }

  return (
    <>
      <section className="bg-[var(--color-surface)]">
        <div
          className={`${wrapClasses} ${
            compact ? 'pb-10 pt-14 min-[601px]:pt-[72px]' : 'pb-[72px] pt-16 min-[601px]:pb-[104px] min-[601px]:pt-[112px]'
          }`}
        >
          <h1
            className={`font-display max-w-[880px] font-bold tracking-tight text-[var(--color-text-primary)] ${
              compact ? 'text-[38px] leading-[1.05] min-[601px]:text-[52px]' : 'text-[42px] leading-[1.02] min-[601px]:text-[56px] min-[961px]:text-[76px]'
            }`}
          >
            Audit any website in about a minute.
          </h1>
          {!compact && (
            <p className="mb-11 mt-6 max-w-[640px] text-lg leading-relaxed text-[var(--color-text-secondary)] min-[601px]:text-xl">
              Speed, SEO, mobile, SSL and AI-search readiness, scored and explained in plain English.
              {enabled && ' Your first audit is free, with no sign-up.'}
            </p>
          )}

          {enabled ? (
            <form onSubmit={submit} noValidate className={`max-w-[720px] ${compact ? 'mt-8' : ''}`}>
              <label htmlFor="site" className="mb-2.5 block text-sm font-semibold text-[var(--color-text-primary)]">
                Paste a website
              </label>
              <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[0_1px_2px_rgba(17,23,38,.04),0_10px_30px_-14px_rgba(17,23,38,.18)] focus-within:border-[var(--color-primary-600)] focus-within:ring-4 focus-within:ring-[var(--color-primary-600)]/15 min-[601px]:flex-row">
                <input
                  id="site"
                  name="website"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  readOnly={running}
                  className="h-[52px] min-w-0 flex-1 bg-transparent px-3.5 text-xl text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] read-only:text-[var(--color-text-secondary)] min-[601px]:h-14"
                />
                <button type="submit" disabled={running} className={`${primary} min-h-14 px-7 text-[17px]`}>
                  {running ? 'Auditing' : 'Audit it'}
                </button>
              </div>
              {!compact && (
                <p className="mt-3.5 text-sm leading-normal text-[var(--color-text-tertiary)]">
                  One free audit per visitor. Sign up free to keep it, and run {PLANS.free.limits.audit} audits a month.
                </p>
              )}
            </form>
          ) : (
            <div className="flex max-w-[720px] flex-wrap items-center justify-between gap-4 rounded-2xl border-[1.5px] border-[var(--color-border)] px-[22px] py-5">
              <p className="text-[17px] text-[var(--color-text-primary)]">{FREE_AUDIT_COPY.off}</p>
              <SignUpLink />
            </div>
          )}

          <div ref={noteRef} aria-live="polite" className="max-w-[720px]">
            {message && (
              <div className="mt-5">
                <Message text={message} offer={signUpOffered(state)} />
              </div>
            )}
          </div>
        </div>
      </section>

      {(state.kind === 'running' || state.kind === 'done') && (
        <section className="bg-[var(--color-bg-primary)] pb-24 pt-12" aria-label="Your audit">
          <div className={wrapClasses}>
            {state.kind === 'running' ? <Running host={state.host} /> : <Result result={state.result} again={state.again} />}
          </div>
        </section>
      )}
    </>
  );
}
