// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

type KeyAudit = { score: number | null; title: string; displayValue?: string };
type LighthouseSummary = {
  categories: Record<string, { score: number; title: string }>;
  keyAudits: Record<string, KeyAudit>;
};

const KEY_AUDIT_IDS = [
  'redirects', 'bootup-time', 'cache-insight', 'unminified-css',
  'unminified-javascript', 'render-blocking-resources', 'uses-optimized-images',
  'uses-webp-images', 'uses-responsive-images', 'offscreen-images',
  'uses-text-compression', 'time-to-first-byte', 'interactive',
  'speed-index', 'first-contentful-paint', 'largest-contentful-paint',
  'total-blocking-time', 'cumulative-layout-shift', 'long-tasks',
  'dom-size-insight', 'unsized-images', 'is-on-https',
  'meta-description', 'document-title', 'link-text', 'image-alt',
  'robots-txt', 'canonical',
];

function trimLighthouseData(data: Record<string, unknown>): LighthouseSummary {
  const lr = data.lighthouseResult as Record<string, unknown> | undefined;
  if (!lr) return { categories: {}, keyAudits: {} };

  const rawCats = (lr.categories ?? {}) as Record<string, { score: number; title: string }>;
  const rawAudits = (lr.audits ?? {}) as Record<string, { score: number | null; title: string; displayValue?: string }>;

  const categories: Record<string, { score: number; title: string }> = {};
  for (const [key, cat] of Object.entries(rawCats)) {
    categories[key] = { score: cat.score, title: cat.title };
  }

  const keyAudits: Record<string, KeyAudit> = {};
  for (const id of KEY_AUDIT_IDS) {
    const a = rawAudits[id];
    if (a) {
      keyAudits[id] = {
        score: a.score,
        title: a.title,
        ...(a.displayValue && { displayValue: a.displayValue }),
      };
    }
  }

  return { categories, keyAudits };
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

  // Get business website
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('website, email')
    .eq('id', businessId)
    .single();

  if (businessError || !business?.website) {
    return NextResponse.json(
      { error: businessError?.message ?? 'Business has no website' },
      { status: 400 }
    );
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
        raw_json: { mobile: trimLighthouseData(mobileData), desktop: trimLighthouseData(desktopData) },
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
