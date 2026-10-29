// app/api/studio/route.ts

// Saves the Brand studio: the account's profile (name, company, logo, contact
// details) and its design (colours, type, header, sections, wording) in one
// update of its own profile row. It runs as the user, so the column grant and
// the own_profile_update policy keep the write to their own row. Pro, Agency
// and the owner only: on Free the studio is a preview.

import { NextRequest, NextResponse } from 'next/server';
import { studioUnavailable } from '@/app/_shared/lib/brand/brand';
import { parseStudioInput, STUDIO_NOT_SAVED } from '@/app/_shared/lib/brand/studioInput';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { planFor, planHas } from '@/app/_shared/lib/usage/plans';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

// Postgres's "no such column" and PostgREST's: the brand studio migration hasn't run
const MISSING_COLUMN = ['42703', 'PGRST204'];

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;
  if (!planHas(planFor(account).id, 'branding')) return NextResponse.json({ error: featureMessage('branding') }, { status: 403 });

  const input = parseStudioInput(await request.json().catch(() => null));
  if (!input.ok) return NextResponse.json({ error: input.error, field: input.field }, { status: 400 });
  const { profile, design } = input;

  const { data, error } = await db
    .from('profiles')
    .update({ ...profile, brand_design: design, updated_at: new Date().toISOString() })
    .eq('id', account.id)
    .select('id');
  if (error) {
    if (MISSING_COLUMN.includes(error.code)) {
      return NextResponse.json({ error: studioUnavailable(account.isOwner) }, { status: 503 });
    }
    console.error('[studio] Failed to save the brand:', error.message);
    return NextResponse.json({ error: STUDIO_NOT_SAVED }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ profile, design });
}
