// app/api/autocomplete/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface Suggestion {
  description: string;
  placeId: string;
}

// Places API (New) autocomplete response shape (only fields we read).
interface PlacePrediction {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
  };
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input') ?? '';
  if (input.trim().length < 2) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  try {
    // Places API (New) — legacy `maps/api/place/autocomplete/json` is disabled
    // for projects created after March 2025 and returns REQUEST_DENIED.
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['(cities)'],
        includedRegionCodes: ['us'], // US-only results
      }),
      signal: AbortSignal.timeout(4000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(
        '[autocomplete] Places API (New) error:',
        data?.error?.status ?? res.status,
        data?.error?.message ?? ''
      );
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions: Suggestion[] = [];
    for (const s of (data.suggestions ?? []) as PlacePrediction[]) {
      const description = s.placePrediction?.text?.text;
      const placeId = s.placePrediction?.placeId;
      if (description && placeId) {
        suggestions.push({ description, placeId });
      }
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
