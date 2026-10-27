// app/_shared/lib/audit/auditBusiness.ts

// One business's audit: a current cached audit is served as it is, otherwise
// the website is audited and the result stored. Used by "Run audit"
// (api/audit), where each audit that runs counts against the account's plan, and
// by free audits requested on devartventures.com, which are audited as soon as
// they arrive (api/inbound/audit-request) and never count. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';
import { runAudit, AuditUnavailableError } from '@/app/_shared/lib/audit/runAudit';
import { pageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedStore';
import { isOutdatedAudit, isStaleAudit, type AuditOutcome, type AuditRow } from '@/app/_shared/lib/audit/types';
import { isUrlOnlySearch } from '@/app/_shared/lib/config/auditRequests';
import type { Audit } from '@/app/_shared/lib/types/auditely';
import { UNMETERED, type Meter } from '@/app/_shared/lib/usage/usage';
import type { LimitReached } from '@/app/_shared/lib/usage/plans';

interface BusinessRecord {
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  searches: { niche: string; location: string } | null;
}

// Newest audit for this business. Ordered + limited so it still works if
// duplicate rows exist (maybeSingle() errors on more than one row).
async function findLatestAudit(db: Db, businessId: string) {
  const { data } = await db
    .from('audits')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function insertAudit(db: Db, businessId: string, row: AuditRow) {
  const { data, error } = await db
    .from('audits')
    .insert({ business_id: businessId, ...row })
    .select()
    .single();
  // Unique violation → a concurrent request stored this business's audit first
  if (error?.code === '23505') return findLatestAudit(db, businessId);
  if (error) console.error('[audit] insert failed:', error.message);
  return data;
}

// Re-audit: overwrite the same row (stable id) and drop its now-stale AI report
async function replaceAudit(db: Db, auditId: string, row: AuditRow) {
  const { data, error } = await db
    .from('audits')
    .update({ ...row, created_at: new Date().toISOString() })
    .eq('id', auditId)
    .select()
    .single();
  if (error || !data) {
    console.error('[audit] update failed:', error?.message);
    return null;
  }
  const { error: deleteError } = await db.from('ai_reports').delete().eq('audit_id', auditId);
  if (deleteError) {
    console.error('[audit] stale AI report delete failed:', deleteError.message);
    return null;
  }
  return data;
}

export type AuditBusinessResult =
  | { ok: true; audit: Audit; email: string | null }
  | { ok: false; status: number; error: string; limit?: LimitReached };

export async function auditBusiness(
  db: Db,
  businessId: string,
  force = false,
  meter: Meter = UNMETERED
): Promise<AuditBusinessResult> {
  const { data, error: businessError } = await db
    .from('businesses')
    .select('name, address, phone, website, email, searches(niche, location)')
    .eq('id', businessId)
    .single();

  if (businessError || !data) {
    if (businessError) console.error('[audit] business lookup failed:', businessError.message);
    return { ok: false, status: 404, error: 'Business not found' };
  }
  const business = data as unknown as BusinessRecord;

  // Email discovery is the core value of the app, so attempt it on EVERY audit
  // request until an email is stored — including cache hits. Reuses the
  // homepage HTML when the audit already fetched it.
  const ensureEmail = async (
    homepageHtml?: string | null,
    pages?: { url: string; html: string }[]
  ): Promise<string | null> => {
    if (business.email) return business.email;
    if (!business.website) return null;
    const found = await findEmail(business.website, { homepageHtml, pages });
    if (found) {
      await db.from('businesses').update({ email: found }).eq('id', businessId);
    }
    return found;
  };

  const existing = await findLatestAudit(db, businessId);

  // Current-engine audit under 30 days old and no Re-audit requested → serve the cached audit
  if (existing && !force && !isOutdatedAudit(existing.engine_version) && !isStaleAudit(existing)) {
    return { ok: true, audit: existing, email: await ensureEmail() };
  }

  if (!business.website) {
    return { ok: false, status: 400, error: 'Business has no website' };
  }

  // Without PageSpeed the audit would be stored as current with no scores
  if (!process.env.GOOGLE_PAGESPEED_API_KEY) {
    return { ok: false, status: 503, error: 'GOOGLE_PAGESPEED_API_KEY is not configured' };
  }

  // A site added by URL or requested on devartventures.com has no business listing:
  // its name is just the domain and its phone came from the site itself, so there
  // is nothing to compare.
  const direct = isUrlOnlySearch(business.searches);

  // The audit counts from here: PageSpeed is called even when the site can't be
  // audited. Only a result that can't be stored is given back.
  const claim = await meter.claim('audit');
  if (!claim.ok) return { ok: false, status: claim.status, error: claim.error, limit: claim.limit };

  // PageSpeed results are shared with other listings of the same website for
  // 30 days; a Re-audit measures afresh.
  let outcome: AuditOutcome;
  try {
    outcome = await runAudit(
      {
        website: business.website,
        name: direct ? '' : business.name,
        address: business.address,
        phone: direct ? null : business.phone,
        niche: direct ? null : (business.searches?.niche ?? null),
        refreshPageSpeed: force,
        discoverEmail: ensureEmail,
      },
      { pageSpeedStore }
    );
  } catch (err) {
    if (err instanceof AuditUnavailableError) {
      return { ok: false, status: 502, error: `Couldn't audit this site: ${err.message}` };
    }
    console.error('[audit] unexpected failure:', err);
    return { ok: false, status: 500, error: 'Audit failed' };
  }

  const saved = existing
    ? await replaceAudit(db, existing.id, outcome.row)
    : await insertAudit(db, businessId, outcome.row);

  if (!saved) {
    await claim.release();
    return { ok: false, status: 500, error: 'Failed to store audit' };
  }

  return { ok: true, audit: saved, email: outcome.email };
}
