// app/api/autocomplete/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input') ?? '';
  if (input.trim().length < 2) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}&types=(cities)&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    const suggestions = (data.predictions ?? []).map(
      (p: { description: string; place_id: string }) => ({
        description: p.description,
        placeId: p.place_id,
      })
    );

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
