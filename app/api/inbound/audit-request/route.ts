// app/api/inbound/audit-request/route.ts

// devartventures.com sends each free audit request here, signed with
// AUDITELY_INBOUND_SECRET. The request is stored in the Requests tab with the
// visitor's name and email, then audited and summarised in the background, so
// the scores are usually ready by the time it's opened. A request sent twice
// is stored once. The header bell hears of it when it arrives and when its
// audit is done (or failed).

import { after, NextRequest, NextResponse } from 'next/server';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { ownerUserId } from '@/app/_shared/lib/supabase/server';
import { auditBusiness } from '@/app/_shared/lib/audit/auditBusiness';
import { generateAiReport } from '@/app/_shared/lib/audit/generateAiReport';
import { requestAudited, requestAuditFailed, requestNew, type RequestRef } from '@/app/_shared/lib/notifications/messages';
import { notify } from '@/app/_shared/lib/notifications/notify';
import { hasInboundSecret, inboundSecret, parseInboundRequest } from '@/app/_shared/lib/requests/inboundRequest';
import { ensureRequestSearchId } from '@/app/_shared/lib/requests/requestSearch';

// The background audit runs within this route's time (PageSpeed alone can take minutes)
export const maxDuration = 300;

const MIGRATION = 'docs/migrations/2026-10-27-audit-requests.sql';

async function storedRequest(searchId: string, sourceId: string): Promise<string | null> {
  const { data } = await serviceDb
    .from('businesses')
    .select('id')
    .eq('search_id', searchId)
    .eq('request->>source_id', sourceId)
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// The audit, then the AI summary. A failure is logged and goes to the bell: the card offers "Run audit".
async function prepareReport(ownerId: string, request: RequestRef) {
  const audited = await auditBusiness(serviceDb, request.id);
  if (!audited.ok) {
    console.error(`[inbound] audit of request ${request.id} failed: ${audited.error}`);
    await notify(serviceDb, ownerId, requestAuditFailed(request, 'audit'));
    return;
  }
  const report = await generateAiReport(serviceDb, audited.audit.id);
  if (!report.ok) {
    console.error(`[inbound] AI summary of request ${request.id} failed: ${report.error}`);
    await notify(serviceDb, ownerId, requestAuditFailed(request, 'summary'));
    return;
  }
  await notify(serviceDb, ownerId, requestAudited(request));
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

  const ownerId = await ownerUserId();
  if (!ownerId) return NextResponse.json({ error: 'Audit requests are not set up' }, { status: 503 });

  const searchId = await ensureRequestSearchId(serviceDb, ownerId);
  if (!searchId) return NextResponse.json({ error: 'Failed to save the request' }, { status: 500 });

  const existing = await storedRequest(searchId, details.source_id);
  if (existing) return NextResponse.json({ id: existing, existing: true });

  const { data, error } = await serviceDb
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
  const ref: RequestRef = { id, host, name: details.name };
  after(async () => {
    await notify(serviceDb, ownerId, requestNew(ref));
    await prepareReport(ownerId, ref);
  });
  return NextResponse.json({ id, existing: false }, { status: 201 });
}
