# Auditely — Design Spec

**Date:** 2026-05-14
**Status:** Approved
**Type:** Internal MVP tool — single user, no auth, no landing page

---

## 1. Product Goal

Auditely is a private internal tool for agencies to:
1. Find businesses by niche + location (Google Places)
2. Audit their websites automatically (Google PageSpeed Insights)
3. Generate AI-powered insights + cold outreach emails (Groq)
4. Download professional PDF reports per business

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Already in codebase |
| Language | TypeScript 5 | Already in codebase |
| Styling | Tailwind CSS v4 + SCSS modules | Already in codebase |
| UI Components | Custom component library | Already in codebase — Button, Input, Modal, Spinner, Toast, etc. |
| State | React `useState` | No new Redux slices needed |
| Database | Supabase (PostgreSQL) | New integration |
| Lead discovery | Google Places API | New integration |
| Website audit | Google PageSpeed Insights API | New integration |
| AI generation | Groq API (groq-sdk) | New integration |
| PDF | @react-pdf/renderer | New integration |

**No shadcn/ui.** The existing custom component library covers all UI needs.

---

## 3. New Dependencies

```
@supabase/supabase-js
@react-pdf/renderer
groq-sdk
```

---

## 4. Environment Variables

All server-side only (no `NEXT_PUBLIC_` prefix). Placeholder values in `.env.local`:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
GOOGLE_PAGESPEED_API_KEY=your_google_pagespeed_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

---

## 5. Database Schema (Supabase)

### `searches`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| niche | text | e.g. "dentists" |
| location | text | e.g. "Los Angeles" |
| created_at | timestamptz | default now() |

### `businesses`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| search_id | uuid | FK → searches.id |
| name | text | |
| address | text | |
| website | text | nullable |
| phone | text | nullable |
| created_at | timestamptz | default now() |

### `audits`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK → businesses.id |
| performance_score | integer | 0–100 |
| seo_score | integer | 0–100 |
| mobile_score | integer | 0–100 |
| ssl_valid | boolean | |
| raw_json | jsonb | Full PageSpeed response |
| created_at | timestamptz | default now() |

### `ai_reports`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| audit_id | uuid | FK → audits.id |
| summary | text | AI-generated paragraph |
| improvements | jsonb | String array, e.g. ["Fix X", "Add Y"] |
| cold_email | text | AI-generated outreach email |
| created_at | timestamptz | default now() |

---

## 6. Application Flow

### Step 1 — Lead Generation
- User enters niche + location, clicks "Find Leads"
- `POST /api/search` checks Supabase for an existing search with same niche+location created today
- If found: returns cached businesses
- If not: calls Google Places API Text Search → then calls Places Details API per result to get `website` and `formatted_phone_number` (these fields are not returned by the basic search endpoint) → stores search + businesses → returns list

### Step 2 — Website Audit
- For each business that has a website URL:
- `POST /api/audit` checks if audit already exists for that business
- If found: returns cached audit
- If not: calls Google PageSpeed Insights API → stores audit → returns scores
- Businesses without a website URL are skipped (shown with "No website" badge)

### Step 3 — AI Report Generation
- For each completed audit:
- `POST /api/generate` checks if ai_report already exists for that audit
- If found: returns cached report
- If not: sends audit data to Groq with structured prompt → stores report → returns output

**Groq prompt template:**
```
Analyze this website audit data and:
1. Summarize key issues in simple business language (2-3 sentences)
2. Suggest 3-5 specific improvements
3. Write a short personalized cold email offering web development services

Business: {name}, Website: {website}
Performance: {performance_score}/100, SEO: {seo_score}/100, Mobile: {mobile_score}/100, SSL: {ssl_valid}

Keep tone: professional, concise, value-focused, not salesy.

Respond in JSON: { "summary": "...", "improvements": ["...", "..."], "cold_email": "..." }
```

### Step 4 — PDF Report
- User clicks "Download PDF Report" on any business card
- `POST /api/pdf` with `{ audit_id }` fetches business + audit + ai_report from Supabase
- Generates PDF via @react-pdf/renderer and returns as downloadable file

---

## 7. API Routes

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/search` | POST | `{ niche, location }` | `{ search_id, businesses[] }` |
| `/api/audit` | POST | `{ business_id }` | `{ audit }` |
| `/api/generate` | POST | `{ audit_id }` | `{ ai_report }` |
| `/api/results` | GET | `?search_id=` | Full nested: businesses → audits → ai_reports — used to restore state on page refresh |
| `/api/pdf` | POST | `{ audit_id }` | PDF file stream |

---

## 8. Folder Structure

```
app/
├── page.tsx                              ← REPLACED — main Auditely dashboard
├── api/
│   ├── search/route.ts
│   ├── audit/route.ts
│   ├── generate/route.ts
│   ├── results/route.ts
│   └── pdf/route.ts
│
app/_shared/
├── lib/
│   ├── supabase/
│   │   └── client.ts                     ← server-side Supabase client
│   └── types/
│       └── auditely.ts                   ← Business, Audit, AiReport, Search types
│
├── components/
│   └── auditely/
│       ├── leadSearchForm/
│       │   └── leadSearchForm.tsx        ← niche + location inputs + Find Leads button
│       ├── businessCard/
│       │   └── businessCard.tsx          ← full card per business
│       ├── auditScores/
│       │   └── auditScores.tsx           ← score indicators (perf/SEO/mobile/SSL)
│       ├── aiReportSection/
│       │   └── aiReportSection.tsx       ← summary + improvements + cold email
│       └── pdfDocument/
│           └── pdfDocument.tsx           ← @react-pdf/renderer document
│
.env.local                                ← placeholder keys (not committed)
.env.local.example                        ← committed template
```

**Unchanged:** All existing UI components, Redux store, providers, auth routes, existing dashboard page.

---

## 9. UI Design

### Visual Style
- Professional, minimal SaaS aesthetic
- Clean typography with clear hierarchy (heading → subheading → body → caption)
- Generous whitespace, subtle borders (`var(--color-border)`)
- CSS custom properties for full dark/light theme support (already in codebase)
- Score indicators as colored circular rings (green ≥80, amber 50–79, red <50)
- No decorative clutter — every element serves information

### Layout

**Header (sticky)**
```
Auditely                                              [Theme Toggle]
```

**Search Zone**
```
┌──────────────────────────────────────────────────────────────────┐
│   Find Your Next Client                                          │
│   Discover businesses, audit their websites, generate leads.     │
│                                                                  │
│   [ Business type          ]  [ City or location     ]  [Find →] │
└──────────────────────────────────────────────────────────────────┘
```

**Results — stats bar (appears after search)**
```
  12 businesses found · 9 audited · 9 AI reports ready
```

**Business Card**
```
┌─────────────────────────────────────────────────────────────────┐
│  City Dental Clinic                    🌐 citydentalclinic.com  │
│  123 Main St, Los Angeles · 📞 (310) 555-0123                   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  AUDIT SCORES                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   72     │  │   68     │  │   81     │  │  SSL ✓   │        │
│  │Performnc │  │   SEO    │  │  Mobile  │  │  Secure  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  AI SUMMARY                                                      │
│  Your site loads slowly on mobile and is missing key SEO         │
│  metadata. These issues are likely costing you leads...          │
│                                                                  │
│  IMPROVEMENTS                                                    │
│  ① Compress images above the fold                               │
│  ② Add meta descriptions to 4 pages                             │
│  ③ Enable gzip text compression                                 │
│  ④ Improve Largest Contentful Paint to under 2.5s              │
│                                                                  │
│  COLD EMAIL                          ──────────────────────      │
│  Hi Dr. Johnson, I noticed your                    [Copy ✓]     │
│  website has some performance...                                 │
│                                                                  │
│  ────────────────────────────────────────────────────────────   │
│  [ ↓ Download PDF Report ]                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Inline loading states per card:**
- Business has no website → muted "No website" badge, card grayed out slightly
- Audit running → score area shows `Spinner` + "Running audit…"
- AI generating → AI section shows `Spinner` + "Generating report…"
- PDF downloading → button shows `Spinner` + "Generating PDF…"

---

## 10. PDF Report Structure

**Brand:** DevArtVentures

1. **Header** — "Website Audit Report" · "Prepared by DevArtVentures" · date
2. **Business Info** — name, website URL, address, phone
3. **Scores Table** — Performance, SEO, Mobile scores + SSL status
4. **AI Summary** — paragraph
5. **Improvements** — numbered list
6. **Cold Email** — formatted block (optional, labeled clearly)
7. **Footer** — "Powered by DevArtVentures" · contact info placeholder

---

## 11. Caching & Optimization Rules

| Scenario | Behavior |
|---|---|
| Same niche+location searched today | Return cached businesses, skip Places API |
| Business already has an audit | Return cached audit, skip PageSpeed API |
| Audit already has an ai_report | Return cached report, skip Groq API |
| Business has no website | Skip audit entirely, show "No website" badge |
| API key not configured | Return 503 with clear error message |

---

## 12. What Is NOT Built

- No authentication
- No landing page
- No multi-user support
- No SaaS billing or plans
- No email sending (cold email is copy-only)
- No shadcn/ui
