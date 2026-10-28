// app/_shared/lib/freeAudit/freeAuditCopy.ts

// What the free audit says to a visitor, and the shape of its answer. Client-safe:
// the landing page imports it, so it stays clear of the rules' Node modules.

import type { AuditFields } from '@/app/_shared/lib/types/auditely';
import { PLANS } from '@/app/_shared/lib/usage/plans';

export type FreeAuditReason = 'off' | 'unavailable' | 'invalid' | 'notPublic' | 'bot' | 'visitor' | 'cap' | 'failed';

export interface FreeAuditView {
  website: string;
  host: string;
  createdAt: string;
  audit: AuditFields;
  report: { summary: string; improvements: string[] } | null;
}

export type FreeAuditResponse =
  | { ok: true; result: FreeAuditView; again: boolean }
  | { ok: false; reason: FreeAuditReason; error: string };

const n = PLANS.free.limits.audit;

export const FREE_AUDIT_COPY = {
  again: `You've had your free audit, so here's the one you ran. Sign up free to keep it and run ${n} audits a month.`,
  visitor: `Someone on this network has already had the free audit. Sign up free to run ${n} audits a month.`,
  cap: 'Free audits are paused for today. Sign up free to run your own now, or try again tomorrow.',
  notPublic: "That isn't a public website. Enter the site's address, like example.com.",
  notFound: (host: string) => `${host} wasn't found. Check the address and try again.`,
  lookupFailed: (host: string) => `Couldn't look up ${host}. Try again in a minute.`,
  bot: "Your browser didn't pass our automated check. Reload the page and try again.",
  off: 'Sign up to audit a website.',
  unavailable: "Free audits aren't available right now. Sign up free to run your own.",
  failed: (host: string, reason: string) =>
    `Couldn't audit ${host}: ${reason.trim().replace(/\.+$/, '')}. Check the address and try again. This didn't use your free audit.`,
  keepTitle: 'Keep this audit',
  keepText: `Sign up free and it's saved to your account, with a PDF to send and ${n} more audits every month.`,
  used: `Your free audit is used. Sign up free to run ${n} audits a month, or audit a whole city's businesses on Pro.`,
};
