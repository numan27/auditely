// app/_shared/lib/freeAudit/keepFreeAudit.ts

// Signing up keeps the landing page's free audit: it becomes a website in the
// new account's Audit tab, with its summary. The audit is taken first, so only
// one account ever keeps it; the copies are written as that account, so Row
// Level Security still decides where they land.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';
import { directSearchId } from '@/app/_shared/lib/audit/directSearch';
import { websiteKey } from '@/app/_shared/lib/utils/websiteUrl';
import { readFreeAuditCookie } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { takeFreeAudit, type FreeAuditRecord } from '@/app/_shared/lib/freeAudit/freeAuditStore';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Supabase answers with { error }; a thrown error reads the same in the log
function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('nothing came back');
  return data;
}

async function copyInto(db: Db, userId: string, record: FreeAuditRecord): Promise<void> {
  let searchId = await directSearchId(db, userId);
  // A new account has no website audits list yet
  if (!searchId) {
    searchId = check<{ id: string }>(await db.from('searches').insert(DIRECT_AUDIT_SEARCH).select('id').single()).id;
  }

  const { data: sites } = await db.from('businesses').select('id, website').eq('search_id', searchId);
  const key = websiteKey(record.website);
  if (sites?.some((b: { website: string | null }) => b.website && websiteKey(b.website) === key)) return;

  const business = check<{ id: string }>(
    await db
      .from('businesses')
      .insert({
        search_id: searchId,
        name: new URL(record.website).hostname.replace(/^www\./, ''),
        address: '',
        website: record.website,
      })
      .select('id')
      .single()
  );
  const audit = check<{ id: string }>(
    await db
      .from('audits')
      .insert({ business_id: business.id, ...record.audit })
      .select('id')
      .single()
  );
  if (record.report) {
    const { error } = await db.from('ai_reports').insert({ audit_id: audit.id, ...record.report });
    if (error) throw new Error(error.message);
  }
}

/** Keeps the visitor's free audit in this account; false when there was none to keep, or it failed */
export async function keepFreeAudit(db: Db, userId: string, keep: string | null | undefined): Promise<boolean> {
  // The same rule the free audit's setup checks before it signs anything
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 32) return false;
  const id = await readFreeAuditCookie(keep, secret);
  if (!id) return false;
  try {
    const record = await takeFreeAudit(id, userId);
    if (!record) return false;
    await copyInto(db, userId, record);
    return true;
  } catch (err) {
    console.error(`[free-audit] Couldn't keep ${id}: ${message(err)}`);
    return false;
  }
}
