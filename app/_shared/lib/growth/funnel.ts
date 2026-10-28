// app/_shared/lib/growth/funnel.ts

// The owner's weekly numbers (Settings → Growth): free audits run and kept, and
// the accounts made in the last 7 and 30 days, with how many of them ran a search,
// audited a website, pay for a plan and emailed a lead from Auditely. Each step
// counts only that window's own accounts, each once. No I/O: growthStore.ts reads.

export interface GrowthRows {
  /** Accounts other than the owner's, made in the last 30 days */
  accounts: { id: string; createdAt: string }[];
  /** Ids of the accounts that did each, in the last 30 days; repeats are fine */
  searched: string[];
  audited: string[];
  emailed: string[];
  /** Ids of the accounts on a live Pro or Agency plan */
  paying: string[];
  /** The last 30 days' free audits; kept when the visitor signed up to keep it */
  freeAudits: { createdAt: string; kept: boolean }[];
}

export interface GrowthCounts {
  days: number;
  freeAudits: number;
  kept: number;
  accounts: number;
  searched: number;
  audited: number;
  paying: number;
  emailed: number;
}

export const GROWTH_WINDOWS = [7, 30] as const;
export const LONGEST_WINDOW = GROWTH_WINDOWS[GROWTH_WINDOWS.length - 1];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The start of the window `days` long that ends now */
export const windowStart = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export function growthCounts(rows: GrowthRows, now: Date): GrowthCounts[] {
  return GROWTH_WINDOWS.map((days) => {
    const since = windowStart(now, days).getTime();
    const inWindow = (iso: string) => new Date(iso).getTime() >= since;
    const cohort = new Set(rows.accounts.filter((a) => inWindow(a.createdAt)).map((a) => a.id));
    const reached = (ids: string[]) => new Set(ids.filter((id) => cohort.has(id))).size;
    const freeAudits = rows.freeAudits.filter((f) => inWindow(f.createdAt));
    return {
      days,
      freeAudits: freeAudits.length,
      kept: freeAudits.filter((f) => f.kept).length,
      accounts: cohort.size,
      searched: reached(rows.searched),
      audited: reached(rows.audited),
      paying: reached(rows.paying),
      emailed: reached(rows.emailed),
    };
  });
}
