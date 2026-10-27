// app/api/crm/route.ts

// "Send to HubSpot": the lead, its audit and a private PDF link go to HubSpot.
// The company id is saved as soon as HubSpot has it, so a retry after a later
// failure updates that company instead of creating another.

import { NextRequest, NextResponse } from 'next/server';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { getSession, ownerOnly, unauthorized } from '@/app/_shared/lib/supabase/server';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';
import { reportToken } from '@/app/_shared/lib/auth/reportLink';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { buildLeadPayload } from '@/app/_shared/lib/crm/leadPayload';
import { describeHubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';

const MIGRATION = 'docs/migrations/2026-10-01-hubspot.sql';

/** A database write the send depends on failed */
class StoreError extends Error {}

async function saveBusiness(db: Db, businessId: string, update: Record<string, string>): Promise<void> {
  const { error } = await db.from('businesses').update(update).eq('id', businessId);
  if (error) {
    console.error('[crm] business update failed:', error.message);
    throw new StoreError(error.message);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!session.account.isOwner) return ownerOnly();
  const { db } = session;

  const body = await request.json().catch(() => ({}));
  const businessId: string = typeof body.business_id === 'string' ? body.business_id : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return NextResponse.json({ error: "HubSpot isn't connected — add HUBSPOT_TOKEN in Vercel." }, { status: 503 });

  const { data } = await db.from('businesses').select(`${BUSINESS_WITH_AUDIT}, searches (niche)`).eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const row = data as BusinessRow & { searches?: { niche: string } | null };
  const business = withAuditData(row);
  if (!business.audit || !business.ai_report) {
    return NextResponse.json({ error: 'Run the audit and AI summary first.' }, { status: 400 });
  }

  const linkToken = await reportToken(business.audit.id);
  if (!linkToken) return NextResponse.json({ error: 'AUTH_SECRET is not configured' }, { status: 503 });

  const lead = buildLeadPayload({
    business,
    niche: row.searches?.niche ?? null,
    audit: business.audit,
    report: business.ai_report,
    reportUrl: `${request.nextUrl.origin}${ROUTES.REPORT}/${linkToken}`,
  });

  try {
    await sendLead(token, lead, {
      savedCompanyId: business.hubspot_company_id ?? null,
      // Saved before the contact and note, so a retry can't duplicate the company
      onCompanySaved: (companyId) => saveBusiness(db, businessId, { hubspot_company_id: companyId }),
    });
  } catch (err) {
    if (err instanceof StoreError) {
      return NextResponse.json(
        { error: `HubSpot has the company, but Auditely couldn't save the link to it — run ${MIGRATION} in Supabase, then send again.` },
        { status: 500 }
      );
    }
    console.error('[crm] HubSpot send failed:', err instanceof Error ? err.message : err);
    const { status, error } = describeHubSpotError(err);
    return NextResponse.json({ error }, { status });
  }

  const sentAt = new Date().toISOString();
  try {
    await saveBusiness(db, businessId, { crm_sent_at: sentAt });
  } catch {
    return NextResponse.json(
      { error: `Sent to HubSpot, but Auditely couldn't record it — run ${MIGRATION} in Supabase.` },
      { status: 500 }
    );
  }
  return NextResponse.json({ crm_sent_at: sentAt });
}
