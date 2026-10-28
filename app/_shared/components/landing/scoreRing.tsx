// app/_shared/components/landing/scoreRing.tsx

// A score as a ring filled to it, in the app's colours for good, middling and
// poor (scoreTone), with the words for each.

import type { CSSProperties } from 'react';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import motion from '@/app/_shared/components/landing/landingMotion.module.scss';

const STROKE: Record<ScoreTone, string> = {
  good: 'stroke-emerald-500',
  ok: 'stroke-amber-500',
  poor: 'stroke-red-500',
  none: 'stroke-transparent',
};

/** A chip in the score's colours */
export const TONE_CHIP: Record<ScoreTone, string> = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ok: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  poor: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  none: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
};

/** A meter's fill in the score's colours */
export const TONE_FILL: Record<ScoreTone, string> = {
  good: 'bg-emerald-500',
  ok: 'bg-amber-500',
  poor: 'bg-red-500',
  none: 'bg-transparent',
};

const TONE_WORDS: Record<ScoreTone, string> = { good: 'Good', ok: 'Needs work', poor: 'Poor', none: 'Not measured' };

export const toneOf = (score: number | null) => scoreTone(score);
export const toneWords = (score: number | null) => TONE_WORDS[scoreTone(score)];

interface ScoreRingProps {
  score: number | null;
  /** Width and height in pixels */
  size?: number;
  /** Fills up as it appears, after `delay` */
  animate?: boolean;
  delay?: string;
  className?: string;
}

export function ScoreRing({ score, size = 46, animate = false, delay, className = '' }: ScoreRingProps) {
  const fill: CSSProperties | undefined = delay ? { animationDelay: delay } : undefined;
  return (
    <span className={`relative inline-grid flex-none place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden className="absolute inset-0">
        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3.4" className="stroke-[var(--color-border)]" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          strokeWidth="3.4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - (score ?? 0)}
          transform="rotate(-90 18 18)"
          className={`${STROKE[scoreTone(score)]} ${animate ? motion.ring : ''}`}
          style={fill}
        />
      </svg>
      <span className="relative font-semibold tabular-nums text-[var(--color-text-primary)]" style={{ fontSize: Math.round(size * 0.3) }}>
        {score ?? '—'}
      </span>
    </span>
  );
}
