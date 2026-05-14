// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

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

  // Get business website
  const { data: business } = await supabase
    .from('businesses')
    .select('website')
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

  const [mobileRes, desktopRes] = await Promise.all([
    fetch(`${base}&strategy=mobile`),
    fetch(`${base}&strategy=desktop`),
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

  const { data: audit, error } = await supabase
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
    .single();

  if (error || !audit) {
    return NextResponse.json({ error: 'Failed to store audit' }, { status: 500 });
  }

  return NextResponse.json({ audit });
}
