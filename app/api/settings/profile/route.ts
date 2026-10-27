// app/api/settings/profile/route.ts

// Saves the signed-in account's profile: the name, company, logo and contact
// details its reports and emails are signed with. It runs as the user, so the
// column grant and the own_profile_update policy both keep the write to their own
// row and away from the email. Every plan may save one: a Free account keeps its
// profile for when it upgrades.

import { NextRequest, NextResponse } from 'next/server';
import { settingsUnavailable } from '@/app/_shared/lib/brand/brand';
import { parseProfileInput } from '@/app/_shared/lib/brand/profileInput';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';

const NOT_SAVED = "Your profile wasn't saved. Try again.";
// Postgres's "no such column" and PostgREST's: the settings migration hasn't run
const MISSING_COLUMN = ['42703', 'PGRST204'];

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;

  // The whole profile is replaced, so a body that isn't one is refused rather than saved as blank
  const parsed: unknown = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: NOT_SAVED }, { status: 400 });
  }
  const input = parseProfileInput(parsed);
  if (!input.ok) return NextResponse.json({ error: input.error, field: input.field }, { status: 400 });
  const { profile } = input;

  const { data, error } = await db
    .from('profiles')
    .update({ ...profile, updated_at: new Date().toISOString() })
    .eq('id', account.id)
    .select('id');
  if (error) {
    if (MISSING_COLUMN.includes(error.code)) {
      return NextResponse.json({ error: settingsUnavailable(account.isOwner) }, { status: 503 });
    }
    console.error('[settings] Failed to save the profile:', error.message);
    return NextResponse.json({ error: NOT_SAVED }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ profile });
}
