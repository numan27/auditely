// app/api/inbound/audit-request/route.ts

// devartventures.com sends each free audit request here, signed with
// AUDITELY_INBOUND_SECRET. The request is stored in the Requests tab with the
// visitor's name and email, then audited and summarised in the background, so
// the scores are usually ready by the time it's opened. A request sent twice
// is stored once.

import { after, NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { auditBusiness } from '@/app/_shared/lib/audit/auditBusiness';
import { generateAiReport } from '@/app/_shared/lib/audit/generateAiReport';
import { hasInboundSecret, inboundSecret, parseInboundRequest } from '@/app/_shared/lib/requests/inboundRequest';
import { ensureRequestSearchId } from '@/app/_shared/lib/requests/requestSearch';

// The background audit runs within this route's time (PageSpeed alone can take minutes)
export const maxDuration = 300;

const MIGRATION = 'docs/migrations/2026-10-27-audit-requests.sql';

async function storedRequest(searchId: string, sourceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .eq('search_id', searchId)
    .eq('request->>source_id', sourceId)
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// The audit, then the AI summary. A failure is only logged: the card offers "Run audit".
async function prepareReport(businessId: string) {
  const audited = await auditBusiness(businessId);
  if (!audited.ok) {
    console.error(`[inbound] audit of request ${businessId} failed: ${audited.error}`);
    return;
  }
  const report = await generateAiReport(audited.audit.id);
  if (!report.ok) console.error(`[inbound] AI summary of request ${businessId} failed: ${report.error}`);
}

export async function POST(request: NextRequest) {
  const secret = inboundSecret();
  if (!secret) {
    console.error('[inbound] AUDITELY_INBOUND_SECRET is not set (32+ characters): audit requests are refused');
    return NextResponse.json({ error: 'Audit requests are not set up' }, { status: 503 });
  }
  if (!hasInboundSecret(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = parseInboundRequest(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { website, host, email, request: details } = parsed.value;

  const searchId = await ensureRequestSearchId();
  if (!searchId) return NextResponse.json({ error: 'Failed to save the request' }, { status: 500 });

  const existing = await storedRequest(searchId, details.source_id);
  if (existing) return NextResponse.json({ id: existing, existing: true });

  const { data, error } = await supabase
    .from('businesses')
    .insert({ search_id: searchId, name: host, address: '', website, email, request: details })
    .select('id')
    .single();
  if (error || !data) {
    // Unique violation → the same request arrived twice at once and the other one was stored
    const stored = error?.code === '23505' ? await storedRequest(searchId, details.source_id) : null;
    if (stored) return NextResponse.json({ id: stored, existing: true });
    console.error(
      '[inbound] Failed to store the request:',
      /request/.test(error?.message ?? '') ? `run ${MIGRATION} in Supabase (${error?.message})` : error?.message
    );
    return NextResponse.json({ error: 'Failed to save the request' }, { status: 500 });
  }

  const id = data.id as string;
  after(() => prepareReport(id));
  return NextResponse.json({ id, existing: false }, { status: 201 });
}
