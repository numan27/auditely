// app/_shared/lib/hooks/useBulkAudit.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { planHas, type LimitReached } from '@/app/_shared/lib/usage/plans';
import { auditBusiness, BULK_CONCURRENCY, type BulkState, type Post } from '@/app/_shared/lib/utils/bulkAudit';
import { postJson } from '@/app/_shared/lib/utils/jsonRequest';
import { runPool } from '@/app/_shared/lib/utils/pool';
import type { BusinessUpdate, BusinessWithData } from '@/app/_shared/lib/types/auditely';

export interface BulkProgress {
  total: number;
  /** Audited or failed so far */
  finished: number;
  failed: number;
  isRunning: boolean;
  /** Stop was pressed: nothing new starts, the running audits finish */
  isStopping: boolean;
}

// A request that never got an answer (offline, cancelled) fails with the connection message
const poster =
  (signal: AbortSignal): Post =>
  (path, body) =>
    postJson(path, body, signal);

/**
 * "Audit all" for a results list: audits the given businesses a few at a time
 * and writes each one's summary. Results go to the list through `onUpdate`,
 * exactly like a card's own audit, so cards that aren't on screen are covered.
 * The run lives in this browser tab: leaving the list cancels it, and what was
 * already audited is kept. A run that gets to the end goes to the header bell.
 * Audit all comes with the paid plans; a run that reaches the plan's monthly
 * audits stops there like Stop, and says why once.
 */
export function useBulkAudit(onUpdate: (businessId: string, update: BusinessUpdate) => void) {
  const demo = useDemo();
  const usage = useUsage();
  const [states, setStates] = useState<Record<string, BulkState>>({});
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  // Counts completed runs, so the list can re-arrange once the scores are in
  const [runsFinished, setRunsFinished] = useState(0);
  const stopRequested = useRef(false);
  const controller = useRef<AbortController | null>(null);
  // The limit is explained once per run, however many audits it turns away
  const limitPrompted = useRef(false);

  const start = useCallback(
    async (targets: BusinessWithData[]) => {
      if (controller.current || targets.length === 0) return;
      if (usage?.summary && !planHas(usage.summary.plan, 'auditAll')) return usage.promptUpgrade({ feature: 'auditAll' });
      const run = new AbortController();
      controller.current = run;
      stopRequested.current = false;
      limitPrompted.current = false;

      setStates((prev) => ({ ...prev, ...Object.fromEntries(targets.map((b) => [b.id, { stage: 'queued' } as BulkState])) }));
      setProgress({ total: targets.length, finished: 0, failed: 0, isRunning: true, isStopping: false });

      const tally = { audited: 0, failed: 0 };
      const onStage = (id: string, state: BulkState) => {
        setStates((prev) => ({ ...prev, [id]: state }));
        if (state.stage !== 'done' && state.stage !== 'failed') return;
        tally[state.stage === 'failed' ? 'failed' : 'audited'] += 1;
        setProgress((p) => p && { ...p, finished: p.finished + 1, failed: p.failed + Number(state.stage === 'failed') });
        usage?.refresh();
      };
      // Nothing new starts once the audits run out; the ones already running finish
      const onLimit = (limit: LimitReached) => {
        stopRequested.current = true;
        setProgress((p) => p && { ...p, isStopping: true });
        if (limitPrompted.current) return;
        limitPrompted.current = true;
        usage?.promptUpgrade({ limit });
      };
      // In the public demo the saved sample answers instead of the API
      const post = demo?.replay ?? poster(run.signal);
      await runPool(targets, (business) => auditBusiness(business, { post, onUpdate, onStage, onLimit }), BULK_CONCURRENCY, () => stopRequested.current);

      // Also after a cancelled run (the list was left): its requests were aborted and count as failed
      controller.current = null;
      // Only a run that got to the end: not one stopped, or cancelled by leaving the list
      if (!demo && !stopRequested.current && !run.signal.aborted) {
        void fetch(API_ROUTES.NOTIFICATIONS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'bulk_done', search_id: targets[0].search_id, ...tally }),
        }).catch(() => {});
      }
      // Stopped before their turn: no longer queued
      setStates((prev) => Object.fromEntries(Object.entries(prev).filter(([, state]) => state.stage !== 'queued')));
      setProgress((p) => p && { ...p, isRunning: false, isStopping: false });
      setRunsFinished((n) => n + 1);
      usage?.refresh();
    },
    [demo, onUpdate, usage]
  );

  const stop = useCallback(() => {
    if (!controller.current) return;
    stopRequested.current = true;
    setProgress((p) => p && { ...p, isStopping: true });
  }, []);

  // Leaving the list (a new search) cancels the run
  useEffect(
    () => () => {
      stopRequested.current = true;
      controller.current?.abort();
    },
    []
  );

  // Closing the tab would cancel the run too: ask first. Not in the demo, where nothing is lost.
  const isRunning = progress?.isRunning ?? false;
  useEffect(() => {
    if (!isRunning || demo) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [demo, isRunning]);

  return { states, progress, runsFinished, start, stop };
}
