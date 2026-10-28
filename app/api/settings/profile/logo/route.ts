// app/api/settings/profile/logo/route.ts

// The signed-in account's logo as an image, for the header's profile menu. Read as
// the user, so it is only ever their own. The menu's address for it changes with
// each profile save, so the browser may keep each one for good. Only a PNG or JPEG
// is sent, the two kinds Settings accepts.

import { NextResponse } from 'next/server';
import { logoFromDataUrl } from '@/app/_shared/lib/brand/brandRules';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const { data, error } = await session.db.from('profiles').select('logo_data_url').eq('id', session.account.id).maybeSingle();
  if (error) {
    console.error('[settings] Failed to read the logo:', error.message);
    return NextResponse.json({ error: "Couldn't load your logo. Try again in a minute." }, { status: 503 });
  }
  const logo = logoFromDataUrl((data?.logo_data_url as string | null | undefined) ?? null);
  if (!logo) return NextResponse.json({ error: 'No logo is saved. Add one in Settings.' }, { status: 404 });

  const bytes = Buffer.from(logo.dataUrl.slice(logo.dataUrl.indexOf(',') + 1), 'base64');
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': logo.contentType,
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}
