// app/_shared/lib/freeAudit/freeAuditStore.ts

// The landing page's free audits, with the service role: no account may read
// the table, since it holds every visitor's audit. claim_free_audit counts and
// inserts under one lock, so a burst of requests can't all get past the
// visitor rule or the daily cap. Server-only.

import { serviceDb } from '@/app/_shared/lib/supabase/client';
import type { AuditRow } from '@/app/_shared/lib/audit/types';

const TABLE = 'free_audits';

export type FreeAuditClaim = { ok: true; id: string } | { ok: false; reason: 'visitor' | 'cap' };

export interface FreeReport {
  summary: string;
  improvements: string[];
  cold_email: string;
}

export interface FreeAuditRecord {
  id: string;
  website: string;
  audit: AuditRow;
  report: FreeReport | null;
  createdAt: string;
  claimedBy: string | null;
}

export interface FreeAuditListing {
  website: string;
  createdAt: string;
  status: 'running' | 'done';
  kept: boolean;
}

interface FreeAuditRow {
  id: string;
  website: string;
  audit: AuditRow;
  report: FreeReport | null;
  created_at: string;
  claimed_by: string | null;
}

const RECORD_COLUMNS = 'id, website, audit, report, created_at, claimed_by';

function toRecord(row: FreeAuditRow): FreeAuditRecord {
  return {
    id: row.id,
    website: row.website,
    audit: row.audit,
    report: row.report,
    createdAt: row.created_at,
    claimedBy: row.claimed_by,
  };
}

/** A running free audit for this visitor, unless they've had one in the window or the day is full */
export async function claimFreeAudit(input: {
  ipHash: string;
  website: string;
  since: Date;
  dayStart: Date;
  dailyCap: number;
}): Promise<FreeAuditClaim> {
  const { data, error } = await serviceDb.rpc('claim_free_audit', {
    p_ip_hash: input.ipHash,
    p_website: input.website,
    p_since: input.since.toISOString(),
    p_day_start: input.dayStart.toISOString(),
    p_daily_cap: input.dailyCap,
  });
  if (error) throw new Error(`free_audits: ${error.message}`);
  const row = (data as { id: string | null; refused: string | null }[] | null)?.[0];
  if (row?.id) return { ok: true, id: row.id };
  if (row?.refused === 'visitor' || row?.refused === 'cap') return { ok: false, reason: row.refused };
  throw new Error('free_audits: claim_free_audit gave no answer');
}

/** Gives a failed audit back, so it doesn't use the visitor's free one */
export async function releaseFreeAudit(id: string): Promise<void> {
  const { error } = await serviceDb.from(TABLE).delete().eq('id', id).eq('status', 'running');
  if (error) console.error(`[free-audit] Couldn't release ${id}: ${error.message}`);
}

export async function saveFreeAudit(id: string, audit: AuditRow, report: FreeReport | null): Promise<void> {
  const { error } = await serviceDb.from(TABLE).update({ status: 'done', audit, report }).eq('id', id);
  if (error) throw new Error(`free_audits: ${error.message}`);
}

/** A finished free audit; null when there's none or it couldn't be read */
export async function findFreeAudit(id: string): Promise<FreeAuditRecord | null> {
  const { data, error } = await serviceDb.from(TABLE).select(RECORD_COLUMNS).eq('id', id).eq('status', 'done').maybeSingle();
  if (error) {
    console.error(`[free-audit] Couldn't read ${id}: ${error.message}`);
    return null;
  }
  return data ? toRecord(data as FreeAuditRow) : null;
}

/** Marks a finished free audit as this account's; null when it's taken already or not finished */
export async function takeFreeAudit(id: string, userId: string): Promise<FreeAuditRecord | null> {
  const { data, error } = await serviceDb
    .from(TABLE)
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'done')
    .is('claimed_by', null)
    .select(RECORD_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error(`[free-audit] Couldn't keep ${id} for ${userId}: ${error.message}`);
    return null;
  }
  return data ? toRecord(data as FreeAuditRow) : null;
}

/** The free audits since `start`, newest first (at most 500); null when they couldn't be read */
export async function freeAuditsSince(start: Date): Promise<FreeAuditListing[] | null> {
  const { data, error } = await serviceDb
    .from(TABLE)
    .select('website, created_at, status, claimed_by')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error(`[free-audit] Couldn't list free audits: ${error.message}`);
    return null;
  }
  return (data as { website: string; created_at: string; status: 'running' | 'done'; claimed_by: string | null }[]).map(
    (row) => ({ website: row.website, createdAt: row.created_at, status: row.status, kept: row.claimed_by !== null })
  );
}
