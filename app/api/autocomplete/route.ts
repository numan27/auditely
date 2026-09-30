// app/api/autocomplete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { autocompleteGoogleCities } from '@/app/_shared/lib/places/googlePlaces';
// import { autocompleteCities } from '@/app/_shared/lib/places/geoapify';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input') ?? '';
  if (input.trim().length < 2) return NextResponse.json({ suggestions: [] });

  // US cities only, via Google Places (New)
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });
  const suggestions = await autocompleteGoogleCities(input, apiKey);

  // Geoapify (free tier) — disabled; to switch back, uncomment its import above,
  // use these lines instead of the Google ones, and restore its attribution in
  // leadSearchForm.tsx.
  // const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  // if (!geoapifyKey) return NextResponse.json({ suggestions: [] });
  // const suggestions = await autocompleteCities(input, geoapifyKey);

  return NextResponse.json({ suggestions });
}
