// app/_shared/lib/usage/usage.ts

// Each account's monthly allowances, counted in usage_events. A costly call claims
// its use first through claim_usage, which counts and records in one locked step,
// so requests at once can't all slip under the limit; a call that fails before
// doing the costly work gives the claim back. The owner is never counted. A user
// may read their own rows (the meter) but only the service role writes them.
// Server-only.

import { NextResponse } from 'next/server';
import { serviceDb, type Db } from '@/app/_shared/lib/supabase/client';
import type { Account } from '@/app/_shared/lib/auth/account';
import { planFor, usagePeriod, USAGE_KINDS, type LimitReached, type UsageKind, type UsageSummary } from './plans';
import { limitMessage } from './usageCopy';

const USAGE_MIGRATION = 'docs/migrations/2026-10-28-usage.sql';
const UNAVAILABLE = "Couldn't check this month's allowance. Try again in a minute.";

export type Claim =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; status: 402 | 503; error: string; limit?: LimitReached };

export interface Meter {
  /** Records one use of `kind`, or refuses it at the limit */
  claim(kind: UsageKind): Promise<Claim>;
  /** The limit when the plan has none of `kind` at all; null otherwise */
  notOnPlan(kind: UsageKind): LimitReached | null;
}

const nothingToRelease = async () => {};

/** For the owner and for work no account pays for */
export const UNMETERED: Meter = {
  claim: async () => ({ ok: true, release: nothingToRelease }),
  notOnPlan: () => null,
};

export function meterFor(account: Account, now: () => Date = () => new Date()): Meter {
  const plan = planFor(account);
  if (plan.id === 'owner') return UNMETERED;

  const reached = (kind: UsageKind, limit: number, at: Date): LimitReached =>
    ({ kind, plan: plan.id, limit, resetsAt: usagePeriod(account, at).end.toISOString() });
  const notOnPlan = (kind: UsageKind) => (plan.limits[kind] === 0 ? reached(kind, 0, now()) : null);

  async function claim(kind: UsageKind): Promise<Claim> {
    const limit = plan.limits[kind];
    if (limit === null) return { ok: true, release: nothingToRelease };
    const at = now();
    if (limit === 0) {
      const refused = reached(kind, 0, at);
      return { ok: false, status: 402, error: limitMessage(refused), limit: refused };
    }

    const { data, error } = await serviceDb.rpc('claim_usage', {
      p_user_id: account.id, p_kind: kind, p_limit: limit, p_since: usagePeriod(account, at).start.toISOString(),
    });
    if (error) {
      console.error(`[usage] Failed to claim ${kind}: run ${USAGE_MIGRATION} in Supabase (${error.message})`);
      return { ok: false, status: 503, error: UNAVAILABLE };
    }
    if (!data) {
      const refused = reached(kind, limit, at);
      return { ok: false, status: 402, error: limitMessage(refused), limit: refused };
    }

    const id = data as string;
    return {
      ok: true,
      release: async () => {
        const { error: releaseError } = await serviceDb.from('usage_events').delete().eq('id', id).eq('user_id', account.id);
        if (releaseError) console.error(`[usage] Failed to give back a ${kind}:`, releaseError.message);
      },
    };
  }

  return { claim, notOnPlan };
}

/** This month's use of each allowance, as the signed-in user sees it; null when it can't be counted */
export async function usageSummary(db: Db, account: Account, now: Date = new Date()): Promise<UsageSummary | null> {
  const plan = planFor(account);
  const { start, end } = usagePeriod(account, now);
  const unlimited = { used: 0, limit: null };
  if (plan.id === 'owner') {
    return { plan: plan.id, resetsAt: end.toISOString(), usage: { search: unlimited, audit: unlimited, email_lookup: unlimited } };
  }

  // A head count per kind: a row list would stop at PostgREST's 1,000 rows
  const counted = await Promise.all(USAGE_KINDS.map(async (kind) => {
    const limit = plan.limits[kind];
    if (limit === null || limit <= 0) return { kind, used: 0, limit, error: null };
    const { count, error } = await db.from('usage_events').select('id', { count: 'exact', head: true })
      .eq('user_id', account.id).eq('kind', kind).gte('created_at', start.toISOString());
    return { kind, used: count ?? 0, limit, error };
  }));

  const failed = counted.find((row) => row.error);
  if (failed?.error) {
    console.error(`[usage] Failed to count ${failed.kind}: run ${USAGE_MIGRATION} in Supabase (${failed.error.message})`);
    return null;
  }
  const usage = Object.fromEntries(counted.map(({ kind, used, limit }) => [kind, { used, limit }])) as UsageSummary['usage'];
  return { plan: plan.id, resetsAt: end.toISOString(), usage };
}

/** The answer for a refused claim: 402 with the limit reached, or 503 */
export function refusal(claim: Extract<Claim, { ok: false }>): NextResponse {
  return NextResponse.json({ error: claim.error, limit: claim.limit }, { status: claim.status });
}
