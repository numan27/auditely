// app/_shared/lib/demo/replay.ts

// The public demo's stand-in for the audit and summary requests: it answers
// from the saved sample, in the shape the real routes use, after a wait long
// enough to watch. A card and "Audit all" run their usual steps on top of it.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import type { Post } from '@/app/_shared/lib/utils/bulkAudit';

// A live audit takes about a minute; the replay is shortened
export const REPLAY_WAIT = { auditMs: 4000, reportMs: 2500 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const failed = (error: string) => ({ ok: false, data: { error } });

export function replayPost(samples: BusinessWithData[], wait: typeof REPLAY_WAIT = REPLAY_WAIT): Post {
  return async (path, body) => {
    if (path === API_ROUTES.AUDIT) {
      const audit = samples.find((b) => b.id === body.business_id)?.audit;
      await sleep(wait.auditMs);
      return audit ? { ok: true, data: { audit } } : failed('This business has no saved audit to replay.');
    }
    if (path === API_ROUTES.GENERATE) {
      const report = samples.find((b) => b.audit?.id === body.audit_id)?.ai_report;
      await sleep(wait.reportMs);
      return report ? { ok: true, data: { ai_report: report } } : failed('This audit has no saved summary to replay.');
    }
    return failed("The demo doesn't run this.");
  };
}
