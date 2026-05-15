// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

// Scrape a single URL for the first mailto: email found
async function scrapeEmail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Auditely/1.0)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/href=["']mailto:([^"'?\s]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// Try homepage, /contact, /about — then Hunter.io as fallback
async function findEmail(website: string): Promise<string | null> {
  const origin = new URL(website).origin;
  const pagesToScrape = [website, `${origin}/contact`, `${origin}/about`];

  for (const url of pagesToScrape) {
    const email = await scrapeEmail(url);
    if (email) return email;
  }

  // Hunter.io fallback
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) return null;

  try {
    const domain = new URL(website).hostname.replace(/^www\./, '');
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}`
    );
    const data = await res.json();
    return (data.data?.emails as { value: string }[])?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const businessId: string = body.business_id ?? '';

  if (!businessId) {
    return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
  }

  // Cache check
  const { data: existingAudit } = await supabase
    .from('audits')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (existingAudit) {
    return NextResponse.json({ audit: existingAudit });
  }

  // Get business website + existing email
  const { data: business } = await supabase
    .from('businesses')
    .select('website, email')
    .eq('id', businessId)
    .single();

  if (!business?.website) {
    return NextResponse.json({ error: 'Business has no website' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PAGESPEED_API_KEY is not configured' }, { status: 503 });
  }

  const encodedUrl = encodeURIComponent(business.website);
  const base = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodedUrl}&key=${apiKey}`;

  // Run PageSpeed + email finder concurrently
  const [mobileRes, desktopRes, foundEmail] = await Promise.all([
    fetch(`${base}&strategy=mobile`),
    fetch(`${base}&strategy=desktop`),
    business.email ? Promise.resolve(business.email) : findEmail(business.website),
  ]);

  const [mobileData, desktopData] = await Promise.all([
    mobileRes.json(),
    desktopRes.json(),
  ]);

  if (!mobileRes.ok || !desktopRes.ok) {
    return NextResponse.json({ error: 'PageSpeed API request failed' }, { status: 502 });
  }

  if (!mobileData.lighthouseResult || !desktopData.lighthouseResult) {
    return NextResponse.json({ error: 'PageSpeed returned no lighthouse data' }, { status: 502 });
  }

  const mobileScore = Math.round(
    (mobileData.lighthouseResult?.categories?.performance?.score ?? 0) * 100
  );
  const seoScore = Math.round(
    (mobileData.lighthouseResult?.categories?.seo?.score ?? 0) * 100
  );
  const performanceScore = Math.round(
    (desktopData.lighthouseResult?.categories?.performance?.score ?? 0) * 100
  );
  const sslValid =
    (mobileData.lighthouseResult?.audits?.['is-on-https']?.score ?? 0) === 1;

  // Store audit + update business email in parallel
  const [auditResult] = await Promise.all([
    supabase
      .from('audits')
      .insert({
        business_id: businessId,
        performance_score: performanceScore,
        seo_score: seoScore,
        mobile_score: mobileScore,
        ssl_valid: sslValid,
        raw_json: { mobile: mobileData, desktop: desktopData },
      })
      .select()
      .single(),
    foundEmail && !business.email
      ? supabase.from('businesses').update({ email: foundEmail }).eq('id', businessId)
      : Promise.resolve(),
  ]);

  if (auditResult.error || !auditResult.data) {
    return NextResponse.json({ error: 'Failed to store audit' }, { status: 500 });
  }

  return NextResponse.json({ audit: auditResult.data, email: foundEmail ?? null });
}
