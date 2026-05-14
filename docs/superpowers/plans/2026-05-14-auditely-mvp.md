# Auditely MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page internal tool that discovers businesses via Google Places, audits their websites with PageSpeed Insights, generates AI insights + cold emails via Groq, and produces downloadable PDF reports.

**Architecture:** All data flows through Next.js API routes (server-side only). The dashboard is a single `'use client'` page that calls these routes sequentially per business. Supabase caches every result — repeat searches/audits/reports skip the external API entirely.

**Tech Stack:** Next.js 16 · TypeScript 5 · Tailwind v4 + SCSS · Supabase (`@supabase/supabase-js`) · Google Places API · Google PageSpeed Insights API · Groq (`groq-sdk`) · `@react-pdf/renderer`

**Testing approach:** No test runner exists in this codebase. Verification uses `npx tsc --noEmit` (type checking) + `npm run lint` after each task, plus manual browser/curl testing for API routes.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `.env.local` | Create | API key placeholders |
| `.env.local.example` | Create | Committed template |
| `next.config.ts` | Modify | Remove token-based redirect; add `serverExternalPackages` for PDF |
| `app/_shared/lib/types/auditely.ts` | Create | All shared TypeScript types |
| `app/_shared/lib/supabase/client.ts` | Create | Server-side Supabase client singleton |
| `docs/supabase-schema.sql` | Create | SQL to run in Supabase dashboard |
| `app/api/search/route.ts` | Create | POST — Google Places → Supabase |
| `app/api/audit/route.ts` | Create | POST — PageSpeed → Supabase |
| `app/api/generate/route.ts` | Create | POST — Groq → Supabase |
| `app/api/results/route.ts` | Create | GET — full nested read from Supabase |
| `app/api/pdf/route.ts` | Create | POST — generate + stream PDF |
| `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx` | Create | `@react-pdf/renderer` document (server-only) |
| `app/_shared/components/auditely/auditScores/auditScores.tsx` | Create | Score ring display (perf/SEO/mobile/SSL) |
| `app/_shared/components/auditely/aiReportSection/aiReportSection.tsx` | Create | Summary + improvements + copy-email |
| `app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx` | Create | Niche + location form |
| `app/_shared/components/auditely/businessCard/businessCard.tsx` | Create | Full business card with inline fetch logic |
| `app/page.tsx` | Replace | Main dashboard |
| `app/layout.tsx` | Modify | Update metadata title/description |

---

## Task 1: Install packages and create environment files

**Files:**
- Create: `.env.local`
- Create: `.env.local.example`

- [ ] **Step 1: Install new dependencies**

```bash
cd /Users/cp/Desktop/Numan/work/auditely
npm install @supabase/supabase-js groq-sdk @react-pdf/renderer
```

Expected: packages added to `node_modules`, `package.json` updated with 3 new dependencies.

- [ ] **Step 2: Create `.env.local` with placeholder values**

Create the file `/Users/cp/Desktop/Numan/work/auditely/.env.local`:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
GOOGLE_PAGESPEED_API_KEY=your_google_pagespeed_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

- [ ] **Step 3: Create `.env.local.example` (committed to repo)**

Create the file `/Users/cp/Desktop/Numan/work/auditely/.env.local.example`:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
GOOGLE_PAGESPEED_API_KEY=your_google_pagespeed_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

- [ ] **Step 4: Commit**

```bash
git add .env.local.example package.json package-lock.json
git commit -m "feat: install supabase, groq-sdk, react-pdf dependencies"
```

---

## Task 2: Update next.config.ts

**Files:**
- Modify: `next.config.ts`

The existing config has a redirect that sends `/` → `/dashboard` when a `token` cookie is set. Since Auditely has no auth and lives at `/`, this redirect must be removed. Also add `serverExternalPackages` so `@react-pdf/renderer` runs correctly in API routes.

- [ ] **Step 1: Replace `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: add serverExternalPackages for react-pdf, remove auth redirect"
```

---

## Task 3: TypeScript types

**Files:**
- Create: `app/_shared/lib/types/auditely.ts`

- [ ] **Step 1: Create the types file**

```typescript
// app/_shared/lib/types/auditely.ts

export interface Search {
  id: string;
  niche: string;
  location: string;
  created_at: string;
}

export interface Business {
  id: string;
  search_id: string;
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  created_at: string;
}

export interface Audit {
  id: string;
  business_id: string;
  performance_score: number;
  seo_score: number;
  mobile_score: number;
  ssl_valid: boolean;
  raw_json: Record<string, unknown>;
  created_at: string;
}

export interface AiReport {
  id: string;
  audit_id: string;
  summary: string;
  improvements: string[];
  cold_email: string;
  created_at: string;
}

export interface BusinessWithData extends Business {
  audit?: Audit;
  ai_report?: AiReport;
}

export type AuditStatus = 'idle' | 'loading' | 'done' | 'error';
export type ReportStatus = 'idle' | 'loading' | 'done' | 'error';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/lib/types/auditely.ts
git commit -m "feat: add Auditely TypeScript types"
```

---

## Task 4: Supabase client

**Files:**
- Create: `app/_shared/lib/supabase/client.ts`

- [ ] **Step 1: Create the Supabase client**

```typescript
// app/_shared/lib/supabase/client.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/lib/supabase/client.ts
git commit -m "feat: add server-side Supabase client"
```

---

## Task 5: Supabase SQL schema

**Files:**
- Create: `docs/supabase-schema.sql`

This file is not executed automatically — run it in the Supabase dashboard SQL editor once your Supabase project is created.

- [ ] **Step 1: Create the schema file**

```sql
-- Run this in your Supabase project: Dashboard → SQL Editor → New query

-- 1. searches
CREATE TABLE IF NOT EXISTS searches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche       TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. businesses
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id   UUID        NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  address     TEXT        NOT NULL DEFAULT '',
  website     TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. audits
CREATE TABLE IF NOT EXISTS audits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  performance_score   INTEGER     NOT NULL DEFAULT 0,
  seo_score           INTEGER     NOT NULL DEFAULT 0,
  mobile_score        INTEGER     NOT NULL DEFAULT 0,
  ssl_valid           BOOLEAN     NOT NULL DEFAULT false,
  raw_json            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ai_reports
CREATE TABLE IF NOT EXISTS ai_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  summary      TEXT        NOT NULL DEFAULT '',
  improvements JSONB       NOT NULL DEFAULT '[]',
  cold_email   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_businesses_search_id  ON businesses(search_id);
CREATE INDEX IF NOT EXISTS idx_audits_business_id    ON audits(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_audit_id   ON ai_reports(audit_id);
CREATE INDEX IF NOT EXISTS idx_searches_niche_loc    ON searches(niche, location, created_at);
```

- [ ] **Step 2: Commit**

```bash
git add docs/supabase-schema.sql
git commit -m "docs: add Supabase SQL schema"
```

---

## Task 6: API route — /api/search

**Files:**
- Create: `app/api/search/route.ts`

Checks Supabase for a same-day cached search first. If none, calls Google Places Text Search, then Places Details per result to get `website` and `phone`. Stores up to 20 results.

- [ ] **Step 1: Create the route**

```typescript
// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const niche: string = (body.niche ?? '').trim().toLowerCase();
  const location: string = (body.location ?? '').trim().toLowerCase();

  if (!niche || !location) {
    return NextResponse.json({ error: 'niche and location are required' }, { status: 400 });
  }

  // Cache check: same niche+location today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingSearch } = await supabase
    .from('searches')
    .select('id')
    .eq('niche', niche)
    .eq('location', location)
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();

  if (existingSearch) {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('search_id', existingSearch.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ search_id: existingSearch.id, businesses: businesses ?? [] });
  }

  // Google Places API key check
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY is not configured' }, { status: 503 });
  }

  // Text Search
  const query = encodeURIComponent(`${niche} in ${location}`);
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`
  );
  const searchData = await searchRes.json();

  if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
    return NextResponse.json(
      { error: `Google Places error: ${searchData.status}` },
      { status: 502 }
    );
  }

  // Create search record
  const { data: newSearch, error: searchInsertError } = await supabase
    .from('searches')
    .insert({ niche, location })
    .select('id')
    .single();

  if (searchInsertError || !newSearch) {
    return NextResponse.json({ error: 'Failed to create search record' }, { status: 500 });
  }

  const places: Array<{ place_id: string; name: string; formatted_address?: string }> =
    (searchData.results ?? []).slice(0, 20);

  const businesses = [];

  for (const place of places) {
    // Places Details for website + phone
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,website,formatted_phone_number&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();
    const d = detailsData.result ?? {};

    const { data: business } = await supabase
      .from('businesses')
      .insert({
        search_id: newSearch.id,
        name: d.name ?? place.name,
        address: d.formatted_address ?? place.formatted_address ?? '',
        website: d.website ?? null,
        phone: d.formatted_phone_number ?? null,
      })
      .select()
      .single();

    if (business) businesses.push(business);
  }

  return NextResponse.json({ search_id: newSearch.id, businesses });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test (requires real API key, otherwise verify 503)**

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"niche":"dentists","location":"Austin TX"}'
```

Expected with no key: `{"error":"GOOGLE_PLACES_API_KEY is not configured"}`
Expected with real key: `{"search_id":"...","businesses":[...]}`

- [ ] **Step 4: Commit**

```bash
git add app/api/search/route.ts
git commit -m "feat: add /api/search route with Places API + Supabase caching"
```

---

## Task 7: API route — /api/audit

**Files:**
- Create: `app/api/audit/route.ts`

Runs two PageSpeed calls concurrently (mobile + desktop). Mobile score = mobile performance, SEO score = mobile SEO category, performance score = desktop performance. SSL validity from the `is-on-https` audit.

- [ ] **Step 1: Create the route**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test (verify 503 without key)**

```bash
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"business_id":"some-uuid"}'
```

Expected with no key: `{"error":"GOOGLE_PAGESPEED_API_KEY is not configured"}`

- [ ] **Step 4: Commit**

```bash
git add app/api/audit/route.ts
git commit -m "feat: add /api/audit route with PageSpeed + Supabase caching"
```

---

## Task 8: API route — /api/generate

**Files:**
- Create: `app/api/generate/route.ts`

Sends audit data to Groq with a structured prompt and stores the JSON response. Uses `response_format: { type: 'json_object' }` to guarantee valid JSON output.

- [ ] **Step 1: Create the route**

```typescript
// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Cache check
  const { data: existing } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ai_report: existing });
  }

  // Fetch audit + business name/website via join
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(name, website)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 503 });
  }

  const groq = new Groq({ apiKey });

  const businessName = (audit.businesses as { name: string; website: string }).name;
  const website = (audit.businesses as { name: string; website: string }).website;

  const prompt = `Analyze this website audit and respond in JSON only.

Business: ${businessName}
Website: ${website}
Performance Score: ${audit.performance_score}/100
SEO Score: ${audit.seo_score}/100
Mobile Score: ${audit.mobile_score}/100
SSL Valid: ${audit.ssl_valid}

Instructions:
1. Write a 2-3 sentence summary of key issues in simple business language
2. List exactly 4 specific, actionable improvements
3. Write a short personalized cold email offering web development services

Tone: professional, concise, value-focused, not salesy.

Respond with ONLY valid JSON in this exact format:
{
  "summary": "...",
  "improvements": ["...", "...", "...", "..."],
  "cold_email": "..."
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1024,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { summary?: string; improvements?: string[]; cold_email?: string } = {};

  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
  }

  const { data: aiReport, error } = await supabase
    .from('ai_reports')
    .insert({
      audit_id: auditId,
      summary: parsed.summary ?? '',
      improvements: parsed.improvements ?? [],
      cold_email: parsed.cold_email ?? '',
    })
    .select()
    .single();

  if (error || !aiReport) {
    return NextResponse.json({ error: 'Failed to store AI report' }, { status: 500 });
  }

  return NextResponse.json({ ai_report: aiReport });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add /api/generate route with Groq AI + Supabase caching"
```

---

## Task 9: API route — /api/results

**Files:**
- Create: `app/api/results/route.ts`

Used to restore full dashboard state on page refresh given a `search_id`. Returns businesses with their nested audits and ai_reports.

- [ ] **Step 1: Create the route**

```typescript
// app/api/results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get('search_id');

  if (!searchId) {
    return NextResponse.json({ error: 'search_id query parameter is required' }, { status: 400 });
  }

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select(`
      *,
      audits (
        *,
        ai_reports (*)
      )
    `)
    .eq('search_id', searchId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businesses: businesses ?? [] });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/results/route.ts
git commit -m "feat: add /api/results route for full nested data retrieval"
```

---

## Task 10: PDF document component

**Files:**
- Create: `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx`

This is a server-only component rendered via `renderToBuffer` inside the `/api/pdf` route. Do not import it in any client component.

- [ ] **Step 1: Create the PDF document**

```typescript
// app/_shared/components/auditely/pdfDocument/pdfDocument.tsx

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    fontSize: 11,
    color: '#374151',
  },
  header: {
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
    borderBottomStyle: 'solid',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 3,
  },
  businessMeta: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 3,
  },
  scoreLabel: {
    fontSize: 8,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreGreen: { color: '#16a34a' },
  scoreAmber: { color: '#d97706' },
  scoreRed: { color: '#dc2626' },
  bodyText: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
    gap: 8,
  },
  bulletNum: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    width: 16,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.5,
  },
  emailBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    borderLeftStyle: 'solid',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    marginBottom: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
  },
});

function scoreColor(score: number) {
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}

export interface PdfDocumentProps {
  businessName: string;
  website: string;
  address: string;
  phone: string | null;
  auditDate: string;
  performanceScore: number;
  seoScore: number;
  mobileScore: number;
  sslValid: boolean;
  summary: string;
  improvements: string[];
  coldEmail: string;
}

export function PdfDocument({
  businessName,
  website,
  address,
  phone,
  auditDate,
  performanceScore,
  seoScore,
  mobileScore,
  sslValid,
  summary,
  improvements,
  coldEmail,
}: PdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Website Audit Report</Text>
          <Text style={styles.headerSubtitle}>
            Prepared by DevArtVentures · {auditDate}
          </Text>
        </View>

        {/* Business Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Business</Text>
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.businessMeta}>{website}</Text>
          <Text style={styles.businessMeta}>{address}</Text>
          {phone ? <Text style={styles.businessMeta}>{phone}</Text> : null}
        </View>

        <View style={styles.divider} />

        {/* Scores */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Audit Scores</Text>
          <View style={styles.scoresRow}>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(performanceScore)]}>
                {performanceScore}
              </Text>
              <Text style={styles.scoreLabel}>Performance</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(seoScore)]}>
                {seoScore}
              </Text>
              <Text style={styles.scoreLabel}>SEO</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(mobileScore)]}>
                {mobileScore}
              </Text>
              <Text style={styles.scoreLabel}>Mobile</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  sslValid ? styles.scoreGreen : styles.scoreRed,
                ]}
              >
                {sslValid ? '✓' : '✗'}
              </Text>
              <Text style={styles.scoreLabel}>SSL</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* AI Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Summary</Text>
          <Text style={styles.bodyText}>{summary}</Text>
        </View>

        {/* Improvements */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recommended Improvements</Text>
          {improvements.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletNum}>{i + 1}.</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Cold Email */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Outreach Email</Text>
          <View style={styles.emailBox}>
            <Text style={styles.bodyText}>{coldEmail}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Powered by DevArtVentures</Text>
          <Text style={styles.footerText}>contact@devartventures.com</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/components/auditely/pdfDocument/pdfDocument.tsx
git commit -m "feat: add PDF document component with react-pdf/renderer"
```

---

## Task 11: API route — /api/pdf

**Files:**
- Create: `app/api/pdf/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import type { PdfDocumentProps } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Fetch audit + business
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(*)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Fetch AI report
  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json(
      { error: 'AI report not found — generate the report first' },
      { status: 404 }
    );
  }

  const business = audit.businesses as {
    name: string;
    website: string | null;
    address: string;
    phone: string | null;
  };

  const auditDate = new Date(audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const props: PdfDocumentProps = {
    businessName: business.name,
    website: business.website ?? '',
    address: business.address,
    phone: business.phone,
    auditDate,
    performanceScore: audit.performance_score,
    seoScore: audit.seo_score,
    mobileScore: audit.mobile_score,
    sslValid: audit.ssl_valid,
    summary: aiReport.summary,
    improvements: aiReport.improvements as string[],
    coldEmail: aiReport.cold_email,
  };

  const buffer = await renderToBuffer(createElement(PdfDocument, props));

  const safeFilename = `audit-${business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')}.pdf`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/pdf/route.ts
git commit -m "feat: add /api/pdf route — generates and streams PDF report"
```

---

## Task 12: auditScores component

**Files:**
- Create: `app/_shared/components/auditely/auditScores/auditScores.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/_shared/components/auditely/auditScores/auditScores.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';

interface ScoreRingProps {
  score: number;
  label: string;
}

function ScoreRing({ score, label }: ScoreRingProps) {
  const valueColor =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  const bgColor =
    score >= 80
      ? 'bg-emerald-50 dark:bg-emerald-950/40'
      : score >= 50
        ? 'bg-amber-50 dark:bg-amber-950/40'
        : 'bg-red-50 dark:bg-red-950/40';

  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 flex-1 ${bgColor}`}>
      <span className={`text-xl font-bold tabular-nums ${valueColor}`}>{score}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
    </div>
  );
}

interface SslBadgeProps {
  valid: boolean;
}

function SslBadge({ valid }: SslBadgeProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 flex-1 ${
        valid
          ? 'bg-emerald-50 dark:bg-emerald-950/40'
          : 'bg-red-50 dark:bg-red-950/40'
      }`}
    >
      <span
        className={`text-xl font-bold ${
          valid
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {valid ? '✓' : '✗'}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        SSL
      </span>
    </div>
  );
}

interface AuditScoresProps {
  audit: Audit;
}

export function AuditScores({ audit }: AuditScoresProps) {
  return (
    <div className="flex gap-2.5">
      <ScoreRing score={audit.performance_score} label="Performance" />
      <ScoreRing score={audit.seo_score} label="SEO" />
      <ScoreRing score={audit.mobile_score} label="Mobile" />
      <SslBadge valid={audit.ssl_valid} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/components/auditely/auditScores/auditScores.tsx
git commit -m "feat: add AuditScores component"
```

---

## Task 13: aiReportSection component

**Files:**
- Create: `app/_shared/components/auditely/aiReportSection/aiReportSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/_shared/components/auditely/aiReportSection/aiReportSection.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import type { AiReport } from '@/app/_shared/lib/types/auditely';

interface AiReportSectionProps {
  report: AiReport;
}

export function AiReportSection({ report }: AiReportSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.cold_email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-2">
          AI Summary
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {report.summary}
        </p>
      </div>

      {/* Improvements */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">
          Improvements
        </p>
        <ol className="space-y-2">
          {report.improvements.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary-600)] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Cold Email */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
            Cold Email
          </p>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </Button>
        </div>
        <div className="rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {report.cold_email}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/components/auditely/aiReportSection/aiReportSection.tsx
git commit -m "feat: add AiReportSection component with copy-to-clipboard"
```

---

## Task 14: leadSearchForm component

**Files:**
- Create: `app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx

'use client';

import { useState } from 'react';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';

interface LeadSearchFormProps {
  onSearch: (niche: string, location: string) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = niche.trim();
    const l = location.trim();
    if (!n || !l || isLoading) return;
    onSearch(n, l);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder="Business type (e.g. dentists, plumbers)"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="flex-1">
        <Input
          placeholder="City or location (e.g. Los Angeles)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || !niche.trim() || !location.trim()}
      >
        {isLoading ? 'Finding…' : 'Find Leads →'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx
git commit -m "feat: add LeadSearchForm component"
```

---

## Task 15: businessCard component

**Files:**
- Create: `app/_shared/components/auditely/businessCard/businessCard.tsx`

Auto-starts the audit on mount with a staggered delay based on `index` (2s per card) to avoid hammering the PageSpeed API simultaneously. Calls generate automatically after audit completes.

- [ ] **Step 1: Create the component**

```typescript
// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import type { Business, Audit, AiReport, AuditStatus, ReportStatus } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
  index: number;
}

export function BusinessCard({ business, initialAudit, initialReport, index }: BusinessCardProps) {
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [pdfLoading, setPdfLoading] = useState(false);

  const runGenerate = useCallback(async (auditId: string) => {
    setReportStatus('loading');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.ai_report);
      setReportStatus('done');
    } catch {
      setReportStatus('error');
    }
  }, []);

  const runAudit = useCallback(async () => {
    setAuditStatus('loading');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAudit(data.audit);
      setAuditStatus('done');
      runGenerate(data.audit.id);
    } catch {
      setAuditStatus('error');
    }
  }, [business.id, runGenerate]);

  // Auto-start audit if business has a website and no cached audit
  useEffect(() => {
    if (!business.website || initialAudit) return;
    const timer = setTimeout(() => {
      runAudit();
    }, index * 1500);
    return () => clearTimeout(timer);
  }, [business.website, initialAudit, index, runAudit]);

  const handleDownloadPdf = async () => {
    if (!audit) return;
    setPdfLoading(true);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: audit.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${business.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
            {business.name}
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{business.address}</p>
          {business.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{business.phone}</p>
          )}
        </div>
        <div className="shrink-0">
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--color-primary-600)] hover:underline break-all text-right block max-w-[200px]"
            >
              {business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : (
            <Badge variant="warning">No website</Badge>
          )}
        </div>
      </div>

      {/* Card Body */}
      {!business.website ? (
        <div className="px-6 py-5">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No website found — skipping audit.
          </p>
        </div>
      ) : (
        <div className="px-6 py-6 space-y-6">
          {/* Audit Scores */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">
              Audit Scores
            </p>
            {auditStatus === 'idle' && (
              <Button variant="outline" size="sm" onClick={runAudit}>
                Run Audit
              </Button>
            )}
            {auditStatus === 'loading' && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Spinner size="sm" />
                <span>Running audit…</span>
              </div>
            )}
            {auditStatus === 'error' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-500">Audit failed.</span>
                <Button variant="ghost" size="sm" onClick={runAudit}>
                  Retry
                </Button>
              </div>
            )}
            {auditStatus === 'done' && audit && <AuditScores audit={audit} />}
          </div>

          {/* AI Report */}
          {auditStatus === 'done' && (
            <div>
              {reportStatus === 'loading' && (
                <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                  <Spinner size="sm" />
                  <span>Generating AI report…</span>
                </div>
              )}
              {reportStatus === 'error' && audit && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">Report generation failed.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runGenerate(audit.id)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {reportStatus === 'done' && report && <AiReportSection report={report} />}
            </div>
          )}
        </div>
      )}

      {/* Card Footer — download button */}
      {audit && report && (
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadPdf}
            isLoading={pdfLoading}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Generating PDF…' : '↓ Download PDF Report'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_shared/components/auditely/businessCard/businessCard.tsx
git commit -m "feat: add BusinessCard component with auto-audit + inline loading states"
```

---

## Task 16: Main dashboard page

**Files:**
- Replace: `app/page.tsx`

This replaces the existing component showcase entirely.

- [ ] **Step 1: Replace `app/page.tsx`**

```typescript
// app/page.tsx

'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { NoContentCard } from '@/app/_shared/components/ui/noContentCard/noContentCard';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

export default function HomePage() {
  const [isSearching, setIsSearching] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessWithData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{ niche: string; location: string } | null>(null);

  const handleSearch = async (niche: string, location: string) => {
    setIsSearching(true);
    setError(null);
    setBusinesses([]);
    setHasSearched(false);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setBusinesses(data.businesses ?? []);
      setLastQuery({ niche, location });
      setHasSearched(true);
      localStorage.setItem('auditely_search_id', data.search_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const withWebsite = businesses.filter((b) => b.website).length;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Auditely
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Hero + Search */}
        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Find your next client
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-xl">
              Discover local businesses, audit their websites automatically, and get AI-powered
              insights and outreach emails — ready to close.
            </p>
          </div>

          <LeadSearchForm onSearch={handleSearch} isLoading={isSearching} />

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
        </section>

        {/* Loading state */}
        {isSearching && (
          <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-secondary)]">
            <Spinner size="md" />
            <span className="text-sm">Fetching businesses…</span>
          </div>
        )}

        {/* Results */}
        {!isSearching && hasSearched && (
          <section className="space-y-6">
            {/* Stats bar */}
            {businesses.length > 0 && lastQuery && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  <strong className="text-[var(--color-text-primary)] font-semibold">
                    {businesses.length}
                  </strong>{' '}
                  businesses found for{' '}
                  <span className="italic">
                    "{lastQuery.niche}" in {lastQuery.location}
                  </span>
                </span>
                {withWebsite < businesses.length && (
                  <span className="text-[var(--color-text-tertiary)]">
                    {businesses.length - withWebsite} without a website (skipped)
                  </span>
                )}
              </div>
            )}

            {businesses.length === 0 ? (
              <NoContentCard
                title="No businesses found"
                description="Try a different niche or location and search again."
              />
            ) : (
              <div className="space-y-5">
                {businesses.map((business, index) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    index={index}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: Auditely dashboard with niche/location inputs and "Find Leads →" button. No component showcase. Dark/light toggle works.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace root page with Auditely dashboard"
```

---

## Task 17: Update layout metadata

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update the metadata in `app/layout.tsx`**

Replace the metadata block (lines 17–48) with:

```typescript
export const metadata: Metadata = {
  title: "Auditely",
  description: "Internal lead generation and website audit tool.",
  robots: {
    index: false,
    follow: false,
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles and lint passes**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Final smoke test**

```bash
npm run dev
```

1. Open `http://localhost:3000` — dashboard loads, title shows "Auditely"
2. Submit the form with no API keys configured:
   - Type "dentists" + "Austin TX", click Find Leads
   - Expected error: `"GOOGLE_PLACES_API_KEY is not configured"`
3. Test `/api/audit` directly:
   ```bash
   curl -X POST http://localhost:3000/api/audit \
     -H "Content-Type: application/json" \
     -d '{"business_id":"00000000-0000-0000-0000-000000000000"}'
   ```
   Expected: `{"error":"GOOGLE_PAGESPEED_API_KEY is not configured"}`
4. Test PDF endpoint with missing audit:
   ```bash
   curl -X POST http://localhost:3000/api/pdf \
     -H "Content-Type: application/json" \
     -d '{"audit_id":"00000000-0000-0000-0000-000000000000"}'
   ```
   Expected: `{"error":"Audit not found"}`

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: update metadata for Auditely"
```

---

## Task 18: Page refresh state restoration

**Files:**
- Modify: `app/page.tsx`

On mount, check `localStorage` for a stored `search_id` from the previous session. If present, call `GET /api/results` to reload the full business/audit/report tree, so the user doesn't lose their work on refresh.

- [ ] **Step 1: Add `useEffect` for restoration at the top of `HomePage`**

Add this import at the top of `app/page.tsx`:

```typescript
import { useState, useEffect } from 'react';
```

Then add this effect inside `HomePage`, directly after the state declarations:

```typescript
// Restore previous session on mount
useEffect(() => {
  const savedSearchId = localStorage.getItem('auditely_search_id');
  if (!savedSearchId) return;

  setIsSearching(true);
  fetch(`/api/results?search_id=${savedSearchId}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.businesses?.length) return;

      // Flatten nested Supabase join into BusinessWithData shape
      const restored: BusinessWithData[] = data.businesses.map(
        (b: BusinessWithData & { audits?: (import('@/app/_shared/lib/types/auditely').Audit & { ai_reports?: import('@/app/_shared/lib/types/auditely').AiReport[] })[] }) => ({
          ...b,
          audit: b.audits?.[0],
          ai_report: b.audits?.[0]?.ai_reports?.[0],
        })
      );

      setBusinesses(restored);
      setHasSearched(true);
    })
    .catch(() => {
      // Silently fail — fresh start is fine
    })
    .finally(() => setIsSearching(false));
}, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test of restoration**

1. Run a search successfully (needs real API keys)
2. Refresh the page
3. Expected: previous results reload automatically without re-fetching from Google Places

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: restore previous session on page refresh via /api/results"
```

---

## Setup checklist before going live

When API keys are ready, complete these steps in order:

1. **Supabase:** Create project → run `docs/supabase-schema.sql` in SQL editor → copy URL + anon key into `.env.local`
2. **Google Places API:** Enable "Places API" in Google Cloud Console → create API key → add to `.env.local` as `GOOGLE_PLACES_API_KEY`
3. **Google PageSpeed:** Enable "PageSpeed Insights API" in Google Cloud Console → same or new key → add as `GOOGLE_PAGESPEED_API_KEY`
4. **Groq:** Create account at console.groq.com → generate API key → add as `GROQ_API_KEY`
5. Restart dev server: `npm run dev`
6. Test full flow: search → cards appear → audits run → AI generates → PDF downloads
