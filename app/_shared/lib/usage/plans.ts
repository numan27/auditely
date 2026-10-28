// app/_shared/lib/usage/plans.ts

// The plans, their monthly allowances and what each one unlocks. The owner has
// no limits and is never counted. A live Stripe subscription sets an account's
// plan; PLAN_OVERRIDES (email:plan pairs) still gives testers one without paying.
// Free allowances reset on the first of each calendar month, UTC; a paid plan's
// every month from its billing anchor. Client-safe: no server imports.

import type { Account } from '@/app/_shared/lib/auth/account';
import { monthlyWindow } from '@/app/_shared/lib/billing/billingRules';

export type UsageKind = 'search' | 'audit' | 'email_lookup';
export const USAGE_KINDS: readonly UsageKind[] = ['search', 'audit', 'email_lookup'];

export type PlanId = 'free' | 'pro' | 'agency' | 'owner';
export type Feature = 'auditAll' | 'export' | 'branding' | 'mailbox' | 'hubspot';

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  /** A month's allowance per kind; null means unlimited */
  limits: Record<UsageKind, number | null>;
  features: Record<Feature, boolean>;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free', name: 'Free', monthlyPrice: 0, yearlyPrice: 0,
    limits: { search: 1, audit: 1, email_lookup: 0 },
    features: { auditAll: false, export: false, branding: false, mailbox: false, hubspot: false },
  },
  pro: {
    id: 'pro', name: 'Pro', monthlyPrice: 24, yearlyPrice: 240,
    limits: { search: 25, audit: 250, email_lookup: 100 },
    features: { auditAll: true, export: true, branding: true, mailbox: true, hubspot: true },
  },
  agency: {
    id: 'agency', name: 'Agency', monthlyPrice: 59, yearlyPrice: 590,
    limits: { search: 80, audit: 1000, email_lookup: 400 },
    features: { auditAll: true, export: true, branding: true, mailbox: true, hubspot: true },
  },
  owner: {
    id: 'owner', name: 'Owner', monthlyPrice: null, yearlyPrice: null,
    limits: { search: null, audit: null, email_lookup: null },
    features: { auditAll: true, export: true, branding: true, mailbox: true, hubspot: true },
  },
};

/** The plans /plans shows; each one is the upgrade from the one before */
export const PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'agency'];

/** What a 402 answer carries: which allowance ran out and when it comes back */
export interface LimitReached {
  kind: UsageKind;
  plan: PlanId;
  limit: number;
  resetsAt: string;
}

export interface UsageSummary {
  plan: PlanId;
  resetsAt: string;
  usage: Record<UsageKind, { used: number; limit: number | null }>;
}

const GRANTABLE: readonly PlanId[] = PLAN_ORDER;

/** PLAN_OVERRIDES as email → plan. Owner can't be granted; malformed entries are skipped */
export function parsePlanOverrides(value: string | undefined): Map<string, PlanId> {
  const overrides = new Map<string, PlanId>();
  for (const entry of (value ?? '').split(',')) {
    const at = entry.lastIndexOf(':');
    if (at < 0) continue;
    const email = entry.slice(0, at).trim().toLowerCase();
    const plan = entry.slice(at + 1).trim().toLowerCase() as PlanId;
    if (email && GRANTABLE.includes(plan)) overrides.set(email, plan);
  }
  return overrides;
}

/** The owner's plan, then a live subscription's, then a tester's override, then Free */
export function planFor(
  account: Pick<Account, 'email' | 'isOwner' | 'subscription'>,
  env: NodeJS.ProcessEnv = process.env
): Plan {
  if (account.isOwner) return PLANS.owner;
  if (account.subscription) return PLANS[account.subscription.plan];
  const override = parsePlanOverrides(env.PLAN_OVERRIDES).get(account.email.trim().toLowerCase());
  return PLANS[override ?? 'free'];
}

/** The calendar month, in UTC, that `now` falls in */
export function calendarMonth(now: Date): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}

/** The month an account's allowances are counted in: from its billing anchor when it pays, else the calendar month */
export function usagePeriod(account: Pick<Account, 'isOwner' | 'subscription'>, now: Date): { start: Date; end: Date } {
  return account.subscription ? monthlyWindow(new Date(account.subscription.anchor), now) : calendarMonth(now);
}

export function planHas(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan].features[feature];
}

/** The limit a kind has reached, or null while some is left (or the plan never had any) */
export function exhausted(summary: UsageSummary, kind: UsageKind): LimitReached | null {
  const { used, limit } = summary.usage[kind];
  if (limit === null || limit <= 0 || used < limit) return null;
  return { kind, plan: summary.plan, limit, resetsAt: summary.resetsAt };
}

/** The `limit` of a 402 answer, or null when the body doesn't carry a valid one */
export function readLimit(body: unknown): LimitReached | null {
  const limit = (body as { limit?: unknown } | null)?.limit as Partial<LimitReached> | undefined;
  if (!limit || typeof limit !== 'object') return null;
  if (!USAGE_KINDS.includes(limit.kind as UsageKind) || !(limit.plan && limit.plan in PLANS)) return null;
  if (typeof limit.limit !== 'number' || typeof limit.resetsAt !== 'string') return null;
  return { kind: limit.kind as UsageKind, plan: limit.plan, limit: limit.limit, resetsAt: limit.resetsAt };
}
