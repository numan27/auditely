// app/api/cron/place-data/route.ts

// Vercel's cron calls this once a day (vercel.json), with CRON_SECRET as its
// bearer token. It blanks Google's place details over 30 days old
// (placeDataErase.ts), but only once PLACE_DATA_ERASE is "on": until then it
// counts what it would blank, and logs it.

import { NextRequest, NextResponse } from 'next/server';
import { erasePlaceData } from '@/app/_shared/lib/places/placeDataErase';
import { hasInboundSecret } from '@/app/_shared/lib/requests/inboundRequest';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[place-data] CRON_SECRET is not set: the daily job is refused');
    return NextResponse.json({ error: 'The place-data job is not set up' }, { status: 503 });
  }
  if (!hasInboundSecret(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const erase = process.env.PLACE_DATA_ERASE === 'on';
  const result = await erasePlaceData(erase);
  if ('error' in result) {
    console.error('[place-data] The daily job failed:', result.error);
    return NextResponse.json({ error: 'The place-data job failed' }, { status: 500 });
  }
  console.log(
    erase
      ? `[place-data] Blanked Google's details on ${result.count} businesses over 30 days old`
      : `[place-data] ${result.count} businesses have Google details over 30 days old. PLACE_DATA_ERASE is off, so they're kept.`
  );
  return NextResponse.json({ erase, count: result.count });
}
