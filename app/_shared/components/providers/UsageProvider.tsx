// app/_shared/components/providers/UsageProvider.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UpgradeModal } from '@/app/_shared/components/auditely/upgradeModal/upgradeModal';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { UsageContext, type Usage, type UpgradePrompt } from '@/app/_shared/lib/hooks/useUsage';
import type { UsageSummary } from '@/app/_shared/lib/usage/plans';

// A run of "Audit all" refreshes after every audit; this asks once
const REFRESH_DEBOUNCE_MS = 1000;

interface UsageProviderProps {
  /** The current allowance's usage, read on the server; null when it couldn't be */
  initial: UsageSummary | null;
  children: ReactNode;
}

/** Keeps the account's allowances current for the header meter, and opens the upgrade dialog */
export function UsageProvider({ initial, children }: UsageProviderProps) {
  const [summary, setSummary] = useState<UsageSummary | null>(initial);
  const [prompt, setPrompt] = useState<UpgradePrompt | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      try {
        const res = await fetch(API_ROUTES.USAGE, { cache: 'no-store' });
        if (res.ok) setSummary(await res.json());
      } catch {
        // The meter keeps its last reading
      }
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  const promptUpgrade = useCallback(
    (next: UpgradePrompt) => {
      setPrompt(next);
      if ('limit' in next) refresh();
    },
    [refresh]
  );

  const usage = useMemo<Usage>(() => ({ summary, refresh, promptUpgrade }), [summary, refresh, promptUpgrade]);

  return (
    <UsageContext.Provider value={usage}>
      {children}
      {prompt && <UpgradeModal prompt={prompt} onClose={() => setPrompt(null)} />}
    </UsageContext.Provider>
  );
}
