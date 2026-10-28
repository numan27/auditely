'use client';

// app/_shared/components/landing/freeAuditHero.tsx

// The landing page's first screen: who Auditely is for, one field to try it, and
// beside them a moving picture of an audit (heroShowcase.tsx). The free audit runs
// here, without an account; the closing band's field runs it here too. While it
// runs and once it's back, the headline shrinks, the picture goes, and the band
// below shows the progress, then the report with a way to keep it.

import { useEffect, useEffectEvent, useReducer, useRef, useState, type FormEvent } from 'react';
import { CheckIcon, PlayIcon } from '@/app/_shared/components/ui/icons/icons';
import { HeroShowcase } from '@/app/_shared/components/landing/heroShowcase';
import { Message, Result, Running, SignUpLink, primary } from '@/app/_shared/components/landing/freeAuditParts';
import { WALKTHROUGH_HASH, wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import motion from '@/app/_shared/components/landing/landingMotion.module.scss';
import { FREE_AUDIT_EVENT, freeAuditStep, signUpOffered, type FreeAuditState } from '@/app/_shared/components/landing/freeAuditFlow';
import { FREE_AUDIT_COPY, type FreeAuditResponse } from '@/app/_shared/lib/freeAudit/freeAuditCopy';
import type { LandingSample } from '@/app/_shared/lib/demo/landingDemo';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { countOf } from '@/app/_shared/lib/usage/usageCopy';
import { normalizeWebsiteUrl } from '@/app/_shared/lib/utils/websiteUrl';

// Free always has limits; only the owner's plan has none
const { audit: freeAudits, search: freeSearches } = PLANS.free.limits as Record<'audit' | 'search', number>;

export const FREE_PLAN_LINE = `Free plan: ${countOf('audit', freeAudits)} and ${countOf('search', freeSearches)} a month`;

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

function Ticks({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-text-secondary)]">
      {lines.map((line) => (
        <li key={line} className="flex items-center gap-1.5">
          <CheckIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
          {line}
        </li>
      ))}
    </ul>
  );
}

interface FreeAuditHeroProps {
  enabled: boolean;
  /** The sample the picture beside the headline audits */
  sample: LandingSample;
  /** Whether there's a recorded walkthrough to link to */
  video: boolean;
}

export function FreeAuditHero({ enabled, sample, video }: FreeAuditHeroProps) {
  const [state, dispatch] = useReducer(freeAuditStep, { kind: 'idle' } as FreeAuditState);
  const [website, setWebsite] = useState('');
  const noteRef = useRef<HTMLDivElement>(null);
  const running = state.kind === 'running';
  const compact = state.kind !== 'idle';
  const message = note(state);

  async function run(address: string) {
    if (running) return;
    // One free audit: a second ask while the result shows says so, and sends nothing
    if (state.kind === 'done') {
      dispatch({ type: 'submit', host: '' });
      noteRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const parsed = normalizeWebsiteUrl(address);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(website);
  }

  // The closing band's field: its address comes up here, and runs as if typed here
  const fromClosingBand = useEffectEvent((address: string) => {
    setWebsite(address);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void run(address);
  });
  useEffect(() => {
    const onAsk = (event: Event) => fromClosingBand(String((event as CustomEvent<string>).detail ?? ''));
    window.addEventListener(FREE_AUDIT_EVENT, onAsk);
    return () => window.removeEventListener(FREE_AUDIT_EVENT, onAsk);
  }, []);

  const field = enabled ? (
    <form onSubmit={submit} noValidate className={`max-w-[600px] ${compact ? 'mt-8' : 'mt-9'}`}>
      <label htmlFor="site" className="mb-2.5 block text-sm font-semibold text-[var(--color-text-primary)]">
        Paste a website
      </label>
      <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[0_1px_2px_rgba(17,23,38,.05),0_16px_40px_-24px_rgba(47,79,224,.45)] focus-within:border-[var(--color-primary-600)] focus-within:ring-4 focus-within:ring-[var(--color-primary-600)]/15 min-[601px]:flex-row">
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
          className="h-[52px] min-w-0 flex-1 bg-transparent px-3.5 text-lg text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] read-only:text-[var(--color-text-secondary)]"
        />
        <button type="submit" disabled={running} className={`${primary} min-h-[52px] whitespace-nowrap px-6 text-base`}>
          {running ? 'Auditing' : 'Audit it free'}
        </button>
      </div>
      {!compact && <Ticks lines={['Your first audit needs no sign-up', FREE_PLAN_LINE]} />}
    </form>
  ) : (
    <div className="mt-9 max-w-[600px]">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-[22px] py-5">
        <p className="text-[17px] text-[var(--color-text-primary)]">{FREE_AUDIT_COPY.off}</p>
        <SignUpLink />
      </div>
      <Ticks lines={[FREE_PLAN_LINE, 'No card needed']} />
    </div>
  );

  return (
    <>
      <section className="relative overflow-hidden bg-[var(--color-surface)]">
        {!compact && <div className={motion.dots} aria-hidden />}
        <div
          className={`relative ${wrapClasses} ${
            compact ? 'pb-10 pt-14 min-[601px]:pt-[72px]' : 'pb-[72px] pt-14 min-[601px]:pb-24 min-[601px]:pt-[88px]'
          }`}
        >
          <div className={compact ? '' : 'grid items-center gap-14 min-[1061px]:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]'}>
            <div>
              {!compact && (
                <p className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-hover)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-xs text-[var(--color-text-secondary)] min-[481px]:text-[13px]">
                  <span className="h-[7px] w-[7px] flex-none rounded-full bg-[var(--color-primary-600)]" aria-hidden />
                  For web designers, SEO freelancers and agencies
                </p>
              )}
              <h1
                className={`font-display max-w-[880px] font-bold tracking-tight text-[var(--color-text-primary)] ${
                  compact
                    ? 'text-[38px] leading-[1.05] min-[601px]:text-[52px]'
                    : 'mt-6 text-[44px] leading-[1.02] min-[601px]:text-[60px] min-[1061px]:text-[66px]'
                }`}
              >
                Find clients whose websites <span className="text-[var(--color-primary-600)]">need you.</span>
              </h1>
              {!compact && (
                <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-[var(--color-text-secondary)]">
                  Audit any website in about a minute. Speed, SEO, mobile, SSL and AI-search readiness, explained in plain
                  English, with the first email written for you. Or audit a whole city at once.
                </p>
              )}
              {field}
              {!compact && video && (
                <a
                  href={WALKTHROUGH_HASH}
                  className="mt-7 inline-flex items-center gap-3 text-base font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary-600)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border-hover)] bg-[var(--color-surface)] text-[var(--color-primary-600)]">
                    <PlayIcon size={14} />
                  </span>
                  Watch the 1-minute demo
                </a>
              )}
              <div ref={noteRef} aria-live="polite" className="max-w-[600px]">
                {message && (
                  <div className="mt-5">
                    <Message text={message} offer={signUpOffered(state)} />
                  </div>
                )}
              </div>
            </div>
            {!compact && <HeroShowcase sample={sample} />}
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
