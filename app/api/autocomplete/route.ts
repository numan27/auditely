// app/api/autocomplete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { autocompleteCities } from '@/app/_shared/lib/places/geoapify';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input') ?? '';
  if (input.trim().length < 2) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  // US cities only, via Geoapify (free tier) in every environment
  const suggestions = await autocompleteCities(input, apiKey);
  return NextResponse.json({ suggestions });
}
