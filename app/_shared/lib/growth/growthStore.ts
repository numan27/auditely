// app/_shared/lib/growth/growthStore.ts

// Reads the owner's weekly numbers (funnel.ts) with the service client: the last
// 30 days' accounts, their searches and audits (usage_events), the leads emailed
// from Auditely (businesses.emailed_at), the live plans, and the free audits. Every
// page of each table is read; the owner's own account is left out. Server only.

import { isLive } from '@/app/_shared/lib/billing/billingRules';
import { isOwnerEmail } from '@/app/_shared/lib/auth/account';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { LONGEST_WINDOW, windowStart, type GrowthRows } from '@/app/_shared/lib/growth/funnel';

const PAGE = 1000;
// 50,000 rows a table: far past a month's use, and a stop should a read never end
const MAX_PAGES = 50;

interface Page<T> {
  data: T[] | null;
  error: { message: string } | null;
}

class ReadFailed extends Error {}

/** Every row a query gives, a page at a time; `query` builds the query for rows from–to */
async function allRows<T>(table: string, query: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await query(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new ReadFailed(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** The funnel's rows for the 30 days to `now`; null when a table couldn't be read */
export async function growthRows(now: Date): Promise<GrowthRows | null> {
  const since = windowStart(now, LONGEST_WINDOW).toISOString();
  try {
    const [profiles, usage, emailed, subscriptions, freeAudits] = await Promise.all([
      allRows<{ id: string; email: string; created_at: string }>('profiles', (from, to) =>
        serviceDb.from('profiles').select('id, email, created_at').gte('created_at', since).order('created_at').range(from, to)
      ),
      allRows<{ user_id: string; kind: string }>('usage_events', (from, to) =>
        serviceDb
          .from('usage_events')
          .select('user_id, kind')
          .gte('created_at', since)
          .in('kind', ['search', 'audit'])
          .order('created_at')
          .range(from, to)
      ),
      allRows<{ user_id: string }>('businesses', (from, to) =>
        serviceDb.from('businesses').select('user_id').gte('emailed_at', since).order('emailed_at').range(from, to)
      ),
      allRows<{ user_id: string; status: string; current_period_end: string }>('subscriptions', (from, to) =>
        serviceDb.from('subscriptions').select('user_id, status, current_period_end').order('user_id').range(from, to)
      ),
      allRows<{ created_at: string; claimed_by: string | null }>('free_audits', (from, to) =>
        serviceDb.from('free_audits').select('created_at, claimed_by').gte('created_at', since).order('created_at').range(from, to)
      ),
    ]);
    const ofKind = (kind: string) => usage.filter((row) => row.kind === kind).map((row) => row.user_id);
    return {
      accounts: profiles.filter((p) => !isOwnerEmail(p.email)).map((p) => ({ id: p.id, createdAt: p.created_at })),
      searched: ofKind('search'),
      audited: ofKind('audit'),
      emailed: emailed.map((row) => row.user_id),
      paying: subscriptions
        .filter((s) => isLive({ status: s.status, periodEnd: s.current_period_end }, now))
        .map((s) => s.user_id),
      freeAudits: freeAudits.map((row) => ({ createdAt: row.created_at, kept: row.claimed_by !== null })),
    };
  } catch (error) {
    console.error(`[growth] Couldn't read the numbers: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
