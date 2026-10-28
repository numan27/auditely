// app/_shared/lib/usage/usageCopy.ts

// The words for allowances: what ran out, when it comes back, what the next plan
// gives, and the short meter in the header. Client-safe.

import { PLANS, PLAN_ORDER, type Feature, type LimitReached, type UsageKind, type UsageSummary } from './plans';

const NOUNS: Record<UsageKind, [string, string]> = {
  search: ['search', 'searches'],
  audit: ['audit', 'audits'],
  email_lookup: ['email lookup', 'email lookups'],
};

const FEATURE_NAMES: Record<Feature, string> = {
  auditAll: 'Audit all',
  export: 'Exporting to CSV and Google Sheets',
  branding: 'Your own branding on reports',
  mailbox: 'Sending from your own mailbox',
  hubspot: 'The HubSpot handoff',
};

/** The paid features as the plans page and the landing page's pricing list them */
export const PLAN_FEATURES: { feature: Feature; label: string }[] = [
  { feature: 'auditAll', label: 'Audit a whole search at once' },
  { feature: 'branding', label: 'Your name and logo on reports' },
  { feature: 'export', label: 'CSV and Google Sheets export' },
  { feature: 'mailbox', label: 'Send from your mailbox' },
  { feature: 'hubspot', label: 'HubSpot handoff' },
];

/** The meter's tie-break: audits first, then searches, then email lookups */
const METER_ORDER: readonly UsageKind[] = ['audit', 'search', 'email_lookup'];

const count = (n: number) => n.toLocaleString('en-US');

/** "1 search", "25 searches", "1,000 audits" */
export function countOf(kind: UsageKind, n: number): string {
  const [one, many] = NOUNS[kind];
  return `${count(n)} ${n === 1 ? one : many}`;
}
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Nov 1": the reset date as it falls in UTC */
export function formatResetDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Mar 14, 2027": a renewal or end date as it falls in UTC */
export function formatBillingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function limitMessage(limit: LimitReached): string {
  const [one, many] = NOUNS[limit.kind];
  if (limit.limit === 0) return `${capitalize(many)} aren't part of the ${PLANS[limit.plan].name} plan.`;
  const date = formatResetDate(limit.resetsAt);
  if (limit.limit === 1) return `You've used this month's ${one}. You get another on ${date}.`;
  return `You've used your ${count(limit.limit)} ${many} this month. They reset on ${date}.`;
}

/** The first plan above this one that gives more of the kind, or null above Agency */
export function upgradeHint(limit: LimitReached): string | null {
  const at = PLAN_ORDER.indexOf(limit.plan);
  if (at < 0) return null;
  for (const id of PLAN_ORDER.slice(at + 1)) {
    const n = PLANS[id].limits[limit.kind];
    if (n !== null && n > limit.limit) return `${PLANS[id].name} gives you ${count(n)} ${NOUNS[limit.kind][1]} a month.`;
  }
  return null;
}

export function featureMessage(feature: Feature): string {
  const names = PLAN_ORDER.filter((id) => PLANS[id].features[feature]).map((id) => PLANS[id].name);
  return `${FEATURE_NAMES[feature]} comes with the ${joinNames(names)} plans.`;
}

/** The allowance closest to running out, or null for an account without limits */
export function meterLabel(summary: UsageSummary): { text: string; empty: boolean } | null {
  let closest: { kind: UsageKind; left: number; limit: number } | null = null;
  for (const kind of METER_ORDER) {
    const { used, limit } = summary.usage[kind];
    if (limit === null || limit <= 0) continue;
    const left = Math.max(0, limit - used);
    if (!closest || left / limit < closest.left / closest.limit) closest = { kind, left, limit };
  }
  if (!closest) return null;
  const [one, many] = NOUNS[closest.kind];
  if (closest.left === 0) return { text: `No ${many} left this month`, empty: true };
  const noun = closest.limit === 1 ? one : many;
  return { text: `${count(closest.left)} of ${count(closest.limit)} ${noun} left this month`, empty: false };
}
