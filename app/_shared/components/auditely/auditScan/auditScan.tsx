// app/_shared/components/auditely/auditScan/auditScan.tsx

// What a card shows while its website is audited: a small browser with the
// site's address, a beam scanning down the page, and the checks the audit runs.
// The checks run together, so none is marked done or given a share of the time.

import styles from './auditScan.module.scss';

/** What an audit looks at, in the order the glow goes round them */
export const AUDIT_CHECKS = ['Mobile speed', 'Desktop speed', 'SEO', 'SSL', 'AI search', 'Contact forms', 'Broken links'] as const;

/** One pass of the beam, and how long the glow stays on each check, as in the stylesheet */
const SCAN_S = 2.6;
const TURN_S = 0.9;

/** The page's blocks, as percentages: [left, top, width, height] */
const BLOCKS: readonly [number, number, number, number][] = [
  [8, 7, 28, 7],
  [64, 7, 28, 7],
  [8, 21, 84, 26],
  [8, 54, 58, 6],
  [8, 64, 40, 6],
  [8, 76, 26, 16],
  [37, 76, 26, 16],
  [66, 76, 26, 16],
];

/** When the beam reaches a block's top: it covers the page in 85% of a pass */
const seenAt = (top: number) => `${((top / 100) * 0.85 * SCAN_S).toFixed(2)}s`;

const Lock = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

interface AuditScanProps {
  domain: string;
  title: string;
  detail?: string;
}

export function AuditScan({ domain, title, detail }: AuditScanProps) {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div
        className="w-full max-w-[15rem] shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm sm:w-52"
        aria-hidden
      >
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--color-border-hover)]" />
          ))}
          <span className="ml-1 flex min-w-0 flex-1 items-center gap-1 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] leading-none text-[var(--color-text-tertiary)]">
            <Lock />
            <span className="truncate">{domain}</span>
          </span>
        </div>
        <div className={`${styles.page} h-28`}>
          {BLOCKS.map(([left, top, width, height]) => (
            <span
              key={`${left}-${top}`}
              className={styles.block}
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, animationDelay: seenAt(top) }}
            />
          ))}
          <span className={styles.beam} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{detail}</p>}
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What the audit checks">
          {AUDIT_CHECKS.map((check, i) => (
            <li
              key={check}
              className={`${styles.check} rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-tertiary)]`}
              style={{ animationDelay: `${(i * TURN_S).toFixed(1)}s` }}
            >
              {check}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
