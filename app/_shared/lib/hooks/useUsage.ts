// app/_shared/lib/hooks/useUsage.ts

'use client';

import { createContext, useContext } from 'react';
import type { Feature, LimitReached, UsageSummary } from '@/app/_shared/lib/usage/plans';

/** What the upgrade dialog explains: an allowance that ran out, or a feature the plan lacks */
export type UpgradePrompt = ({ limit: LimitReached } | { feature: Feature }) & {
  /** A way on without upgrading, such as "Search the website only" */
  continueLabel?: string;
  onContinue?: () => void;
};

export interface Usage {
  /** The current period's use of each allowance; null until it could be loaded */
  summary: UsageSummary | null;
  /** Reads the usage again, at most once a second */
  refresh: () => void;
  /** Opens the upgrade dialog */
  promptUpgrade: (prompt: UpgradePrompt) => void;
}

export const UsageContext = createContext<Usage | null>(null);

/** The signed-in account's allowances, or null outside the signed-in app (the demo) */
export const useUsage = (): Usage | null => useContext(UsageContext);
