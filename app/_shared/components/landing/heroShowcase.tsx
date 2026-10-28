'use client';

// app/_shared/components/landing/heroShowcase.tsx

// The hero's picture of Auditely at work on the sample site: its audit, the
// plain-English summary, the first email and the report, a scene every few
// seconds. The tabs under it pick a scene; the button beside them pauses. It
// starts paused for a visitor who asked for less motion.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { PlayIcon } from '@/app/_shared/components/ui/icons/icons';
import { ScoreRing, TONE_CHIP, toneOf, toneWords } from '@/app/_shared/components/landing/scoreRing';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import motion from '@/app/_shared/components/landing/landingMotion.module.scss';
import type { LandingSample } from '@/app/_shared/lib/demo/landingDemo';

const SCENES = ['Audit', 'Summary', 'Email', 'Report'] as const;
/** As long as the tab's bar takes to fill (landingMotion.module.scss) */
const SCENE_MS = 4600;

const REDUCED = '(prefers-reduced-motion: reduce)';
const watchMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** The visitor's "reduce motion" setting; off on the server */
function useReducedMotion(): boolean {
  return useSyncExternalStore(watchMotion, () => window.matchMedia(REDUCED).matches, () => false);
}

const delay = (i: number, from = 0.1, step = 0.09) => `${(from + i * step).toFixed(2)}s`;

/** "Your site takes over 21 seconds…" and the rest of the summary */
function firstSentence(text: string): [string, string] {
  const end = text.search(/[.!?](\s|$)/);
  return end < 0 ? [text, ''] : [text.slice(0, end + 1), text.slice(end + 1).trim()];
}

function AuditScene({ sample }: { sample: LandingSample }) {
  const measured = sample.scores.filter((s) => s.score !== null);
  const weakest = measured.reduce((low, s) => (s.score! < low.score! ? s : low), measured[0]);
  return (
    <div>
      <div className={`${motion.rise} flex items-start justify-between gap-3`}>
        <div className="min-w-0">
          <p className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">{sample.name}</p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {sample.place}
            {sample.rating !== null && ` · ${sample.rating} stars, ${sample.reviews?.toLocaleString('en-US')} reviews`}
          </p>
        </div>
        {sample.ssl !== null && (
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CHIP[sample.ssl ? 'good' : 'poor']}`}>
            {sample.ssl ? 'SSL valid' : 'SSL invalid'}
          </span>
        )}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2.5 min-[481px]:grid-cols-3">
        {sample.scores.map((s, i) => (
          <li
            key={s.label}
            className={`${motion.rise} flex flex-col items-start gap-2.5 rounded-[14px] border border-[var(--color-border)] p-3`}
            style={{ animationDelay: delay(i) }}
          >
            <ScoreRing score={s.score} animate delay={delay(i)} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-snug text-[var(--color-text-primary)]">{s.label}</span>
              <span className="block text-xs text-[var(--color-text-secondary)]">{toneWords(s.score)}</span>
            </span>
          </li>
        ))}
      </ul>
      {weakest && (
        <p
          className={`${motion.rise} mt-4 rounded-[14px] px-4 py-3 text-[15px] font-semibold ${TONE_CHIP[toneOf(weakest.score)]}`}
          style={{ animationDelay: '0.75s' }}
        >
          Weakest check: {weakest.label}, {weakest.score} out of 100
        </p>
      )}
    </div>
  );
}

function SummaryScene({ sample }: { sample: LandingSample }) {
  const [lead, rest] = firstSentence(sample.summary);
  return (
    <div>
      <p className={`${motion.rise} font-mono text-[13px] font-medium text-[var(--color-primary-600)]`}>In plain English</p>
      <p
        className={`${motion.rise} mt-2.5 font-display text-xl font-semibold leading-snug tracking-tight text-[var(--color-text-primary)]`}
        style={{ animationDelay: '0.1s' }}
      >
        {lead}
      </p>
      {rest && (
        <p className={`${motion.rise} mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]`} style={{ animationDelay: '0.25s' }}>
          {rest}
        </p>
      )}
      <p className={`${motion.rise} mt-5 text-sm font-semibold text-[var(--color-text-primary)]`} style={{ animationDelay: '0.4s' }}>
        What to fix first
      </p>
      <ol className="mt-2 grid gap-2">
        {sample.improvements.map((fix, i) => (
          <li
            key={fix}
            className={`${motion.rise} grid grid-cols-[22px_1fr] gap-2.5 text-sm text-[var(--color-text-primary)]`}
            style={{ animationDelay: delay(i, 0.5, 0.12) }}
          >
            <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-[var(--color-primary-600)]/10 font-mono text-xs font-semibold text-[var(--color-primary-600)]">
              {i + 1}
            </span>
            <span>{fix}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmailScene({ sample }: { sample: LandingSample }) {
  const row = 'border-b border-[var(--color-border)] px-3.5 py-2.5 text-sm text-[var(--color-text-secondary)]';
  return (
    <div>
      <p className={`${motion.rise} font-mono text-[13px] font-medium text-[var(--color-primary-600)]`}>The first email, ready to send</p>
      <div className={`${motion.rise} mt-3 overflow-hidden rounded-[14px] border border-[var(--color-border)]`} style={{ animationDelay: '0.1s' }}>
        <p className={row}>
          To <span className="font-semibold text-[var(--color-text-primary)]">{sample.name}</span>
        </p>
        <p className={row}>
          Subject <span className="font-semibold text-[var(--color-text-primary)]">{sample.email.subject}</span>
        </p>
        <div className="px-3.5 py-3 text-[14.5px] leading-relaxed text-[var(--color-text-primary)]">
          <p className={motion.rise} style={{ animationDelay: '0.3s' }}>
            {sample.email.body}
          </p>
          <p className={`${motion.rise} mt-3 text-[var(--color-text-secondary)]`} style={{ animationDelay: '0.6s' }}>
            Your name · Your agency
          </p>
        </div>
      </div>
      <p className={`${motion.rise} mt-3.5 text-sm text-[var(--color-text-secondary)]`} style={{ animationDelay: '0.8s' }}>
        The PDF report goes with it.
      </p>
    </div>
  );
}

function ReportScene({ sample }: { sample: LandingSample }) {
  return (
    <div className={`${motion.rise} overflow-hidden rounded-[14px] border border-[var(--color-border)]`}>
      <div className="flex items-center justify-between gap-3 bg-[var(--color-bg-primary)] px-4 py-3.5">
        <span className="flex items-center gap-2.5">
          <span className="grid h-[34px] place-items-center rounded-lg border-[1.5px] border-dashed border-[var(--color-border-hover)] px-2.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
            YOUR LOGO
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Your agency</span>
        </span>
        <span className="hidden font-mono text-xs text-[var(--color-text-secondary)] min-[481px]:inline">Website audit</span>
      </div>
      <div className="p-4">
        <p className="text-[13px] text-[var(--color-text-secondary)]">Prepared for</p>
        <p className="font-display text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">{sample.name}</p>
        <ul className="mt-3.5 flex flex-wrap gap-2">
          {sample.scores.map((s, i) => (
            <li
              key={s.label}
              className={`${motion.rise} rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CHIP[toneOf(s.score)]}`}
              style={{ animationDelay: delay(i, 0.15, 0.06) }}
            >
              {s.label} {s.score ?? '—'}
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2" aria-hidden>
          {['92%', '78%', '85%'].map((width, i) => (
            <span
              key={width}
              className={`${motion.rise} block h-2 rounded-full bg-[var(--color-bg-secondary)]`}
              style={{ width, animationDelay: delay(i, 0.5, 0.1) }}
            />
          ))}
        </div>
        <p className={`${motion.rise} mt-4 text-sm text-[var(--color-text-secondary)]`} style={{ animationDelay: '0.8s' }}>
          On Pro and Agency, your name, logo, contact details and booking link go on every report.
        </p>
      </div>
    </div>
  );
}

const SCENE_VIEWS = [AuditScene, SummaryScene, EmailScene, ReportScene];

export function HeroShowcase({ sample }: { sample: LandingSample }) {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  // null follows the visitor's motion setting until they press pause or play
  const [pausedByVisitor, setPaused] = useState<boolean | null>(null);
  // Counts the picks, so a picked scene gets its full time before the next
  const [pick, setPick] = useState(0);
  const paused = pausedByVisitor ?? reduced;

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => clearTimeout(id);
  }, [scene, paused, pick]);

  return (
    <figure className="m-0" aria-label={`Auditely at work on ${sample.host}`}>
      <div className={`${cardClasses} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3" aria-hidden>
          <span className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-hover)]" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--color-text-secondary)]">
            {sample.host}
          </span>
        </div>
        {/* Every scene sits in the same cell, so the picture keeps the tallest one's
            height at any width and never jumps; only the open one shows. A new key
            replays its entrance. */}
        <div className="grid p-5 min-[601px]:p-6">
          {SCENE_VIEWS.map((View, i) => (
            <div key={i === scene ? `on-${i}` : `off-${i}`} className={`[grid-area:1/1] ${i === scene ? '' : 'invisible'}`}>
              <View sample={sample} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1 min-[481px]:gap-2">
        {SCENES.map((label, i) => {
          const on = i === scene;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setScene(i);
                setPick((n) => n + 1);
              }}
              className={`relative h-10 overflow-hidden rounded-[10px] border px-2.5 text-[13px] font-semibold transition-colors min-[481px]:px-3.5 min-[481px]:text-sm ${
                on
                  ? 'border-[var(--color-border-hover)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {label}
              {on && !paused && (
                <span key={`${scene}-${pick}`} className={`${motion.bar} absolute bottom-0 left-0 h-0.5 bg-[var(--color-primary-600)]`} aria-hidden />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? 'Play the animation' : 'Pause the animation'}
          className="ml-auto grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {paused ? (
            <PlayIcon size={14} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>
      </div>
    </figure>
  );
}
