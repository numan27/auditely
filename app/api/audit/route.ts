// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';
import { runAudit, AuditUnavailableError } from '@/app/_shared/lib/audit/runAudit';
import { pageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedStore';
import { isOutdatedAudit, isStaleAudit, type AuditOutcome, type AuditRow } from '@/app/_shared/lib/audit/types';
import { isDirectAuditSearch } from '@/app/_shared/lib/config/directAudits';

// PageSpeed can be slow; runAudit keeps PageSpeed inside a 240 s budget.
export const maxDuration = 300;

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
async function findLatestAudit(businessId: string) {
  const { data } = await supabase
    .from('audits')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function insertAudit(businessId: string, row: AuditRow) {
  const { data, error } = await supabase
    .from('audits')
    .insert({ business_id: businessId, ...row })
    .select()
    .single();
  // Unique violation → a concurrent request stored this business's audit first
  if (error?.code === '23505') return findLatestAudit(businessId);
  if (error) console.error('[audit] insert failed:', error.message);
  return data;
}

// Re-audit: overwrite the same row (stable id) and drop its now-stale AI report
async function replaceAudit(auditId: string, row: AuditRow) {
  const { data, error } = await supabase
    .from('audits')
    .update({ ...row, created_at: new Date().toISOString() })
    .eq('id', auditId)
    .select()
    .single();
  if (error || !data) {
    console.error('[audit] update failed:', error?.message);
    return null;
  }
  const { error: deleteError } = await supabase.from('ai_reports').delete().eq('audit_id', auditId);
  if (deleteError) {
    console.error('[audit] stale AI report delete failed:', deleteError.message);
    return null;
  }
  return data;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessId: string = typeof body.business_id === 'string' ? body.business_id : '';
  const force = body.force === true;

  if (!businessId) {
    return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
  }

  const { data, error: businessError } = await supabase
    .from('businesses')
    .select('name, address, phone, website, email, searches(niche, location)')
    .eq('id', businessId)
    .single();

  if (businessError || !data) {
    if (businessError) console.error('[audit] business lookup failed:', businessError.message);
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
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
      await supabase.from('businesses').update({ email: found }).eq('id', businessId);
    }
    return found;
  };

  const existing = await findLatestAudit(businessId);

  // Current-engine audit under 30 days old and no Re-audit requested → serve the cached audit
  if (existing && !force && !isOutdatedAudit(existing.engine_version) && !isStaleAudit(existing)) {
    return NextResponse.json({ audit: existing, email: await ensureEmail() });
  }

  if (!business.website) {
    return NextResponse.json({ error: 'Business has no website' }, { status: 400 });
  }

  // Without PageSpeed the audit would be stored as current with no scores
  if (!process.env.GOOGLE_PAGESPEED_API_KEY) {
    return NextResponse.json({ error: 'GOOGLE_PAGESPEED_API_KEY is not configured' }, { status: 503 });
  }

  // A site added by URL has no business listing: its name is just the domain
  // and its phone came from the site itself, so there is nothing to compare.
  const direct = isDirectAuditSearch(business.searches);

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
      return NextResponse.json({ error: `Couldn't audit this site: ${err.message}` }, { status: 502 });
    }
    console.error('[audit] unexpected failure:', err);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }

  const saved = existing
    ? await replaceAudit(existing.id, outcome.row)
    : await insertAudit(businessId, outcome.row);

  if (!saved) {
    return NextResponse.json({ error: 'Failed to store audit' }, { status: 500 });
  }

  return NextResponse.json({ audit: saved, email: outcome.email });
}
