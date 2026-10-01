# HubSpot Hand-off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Send to HubSpot" button per lead creates or updates the HubSpot company (and contact, when there's an email) with a note holding the audit and a private PDF link.

**Architecture:** `leadPayload.ts` (pure) turns a business + audit + AI report into HubSpot properties and a note. `hubspot.ts` sends them (find-or-create company and contact, link, note) with error mapping. `/api/crm` wires it, saving the HubSpot company id as soon as it exists. A signed token (`reportLink.ts`, using signing helpers moved out of `session.ts`) makes `/report/{token}` a public, unguessable PDF link served by a shared `renderAuditPdf`.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5, Web Crypto (HMAC), HubSpot CRM API (`2026-09`), @react-pdf/renderer, Supabase, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-01-hubspot-handoff-design.md`

## Global Constraints

- Imports of shared code use `@/app/_shared/...`; routes come from `ROUTES` / `API_ROUTES` (never hardcoded strings); files under 300 lines; camelCase names.
- No new npm dependencies. `HUBSPOT_TOKEN` is read only on the server.
- HubSpot paths use the version constant `2026-09` in one place (`hubspot.ts`).
- Lifecycle stage / lead status are sent only when creating a record.
- Every value in the note HTML is escaped.
- Only `/report/{token}` becomes public; everything else stays behind the login.
- **Git:** work on `staging`; do not commit until the user says so; never push.
- Test commands: one file `npx vitest run <path>`; all `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build`.

## Review Focus

1. **A session cookie value or a token for another audit used as a report link** must be refused. Pinned in Task 1.
2. **Business or AI text containing HTML** (`<`, `&`, quotes) must appear as text in the HubSpot note, never as markup. Pinned in Task 3.
3. **A company deleted in HubSpot after a previous send** must not break re-sending (find by domain or create). Pinned in Task 4.
4. **A failure after the company step** (contact, note, network) must leave the company id saved so a retry doesn't duplicate it. Pinned in Tasks 4 and 5.
5. **A niche like "lawn care" or "website audits"** must not get a wrong industry. Pinned in Task 3.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/_shared/lib/auth/signing.ts` | create | `getSecret`, `sign`, `safeEqual` (moved from `session.ts`) |
| `app/_shared/lib/auth/session.ts` | modify | Import the signing helpers |
| `app/_shared/lib/auth/reportLink.ts` | create | `reportToken`, `verifyReportToken` |
| `app/_shared/lib/config/routes.ts` | modify | `ROUTES.REPORT` (public), `API_ROUTES.CRM` |
| `app/_shared/lib/audit/auditPdf.ts` | create | `renderAuditPdf(auditId)` |
| `app/api/pdf/route.ts` | modify | Use `renderAuditPdf` |
| `app/report/[token]/route.ts` | create | Public PDF link |
| `app/_shared/lib/crm/leadPayload.ts` | create | Properties, industry mapping, note HTML |
| `app/_shared/lib/crm/hubspot.ts` | create | `sendLead`, `HubSpotError`, `describeHubSpotError` |
| `app/api/crm/route.ts` | create | `POST { business_id }` |
| `app/_shared/lib/types/auditely.ts` | modify | `hubspot_company_id`, `crm_sent_at` |
| `app/_shared/lib/hooks/useCrmSend.ts` | create | Button state |
| `app/_shared/components/auditely/reportActions/reportActions.tsx` | create | Footer: Send to HubSpot + Download PDF |
| `app/_shared/components/auditely/auditPanel/auditPanel.tsx` | modify | Use `ReportActions` |
| `docs/migrations/2026-10-01-hubspot.sql`, `docs/supabase-schema.sql` | create / modify | Two columns |

---

### Task 1: Signed report links

**Files:**
- Create: `app/_shared/lib/auth/signing.ts`, `app/_shared/lib/auth/reportLink.ts`
- Modify: `app/_shared/lib/auth/session.ts`
- Test: `app/_shared/lib/auth/__tests__/reportLink.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // signing.ts
  export function getSecret(): string | null;
  export function sign(value: string, secret: string): Promise<string>;
  export function safeEqual(a: string, b: string): boolean;
  // reportLink.ts
  export function reportToken(auditId: string): Promise<string | null>;
  export function verifyReportToken(token: string): Promise<string | null>; // the audit id, or null
  ```

- [ ] **Step 1: Write the failing tests** — create `app/_shared/lib/auth/__tests__/reportLink.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportToken, verifyReportToken } from '@/app/_shared/lib/auth/reportLink';
import { createSessionToken } from '@/app/_shared/lib/auth/session';

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

afterEach(() => vi.unstubAllEnvs());

describe('report links', () => {
  it('turns a token back into its audit id', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = await reportToken(AUDIT);
    expect(token).toMatch(new RegExp(`^${AUDIT}\\.[A-Za-z0-9_-]+$`));
    expect(await verifyReportToken(token!)).toBe(AUDIT);
  });

  it('refuses a changed signature, another audit, or garbage', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = (await reportToken(AUDIT))!;
    const signature = token.slice(AUDIT.length + 1);
    const flipped = signature[0] === 'A' ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    expect(await verifyReportToken(`${AUDIT}.${flipped}`)).toBeNull();
    expect(await verifyReportToken(`${OTHER}.${signature}`)).toBeNull();
    expect(await verifyReportToken('nonsense')).toBeNull();
    expect(await verifyReportToken('')).toBeNull();
  });

  it('never accepts a session cookie value as a report link', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    expect(await verifyReportToken(await createSessionToken())).toBeNull();
  });

  it('stops working when the secret changes, and is off without one', async () => {
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
    const token = (await reportToken(AUDIT))!;
    vi.stubEnv('AUTH_SECRET', 'b'.repeat(40));
    expect(await verifyReportToken(token)).toBeNull();
    vi.stubEnv('AUTH_SECRET', '');
    expect(await reportToken(AUDIT)).toBeNull();
    expect(await verifyReportToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/auth/__tests__/reportLink.test.ts`
Expected: FAIL — `Cannot find package '@/app/_shared/lib/auth/reportLink'`.

- [ ] **Step 3: Move the signing helpers** — create `app/_shared/lib/auth/signing.ts`:

```ts
// app/_shared/lib/auth/signing.ts

// HMAC-SHA256 signatures with AUTH_SECRET, for the session cookie and the
// private report links. Web Crypto only, so it runs in proxy.ts and route handlers.

const encoder = new TextEncoder();

/** AUTH_SECRET when it's long enough to sign with */
export function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

// Constant-time string compare (length leak only, which is fixed for signatures)
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

In `session.ts`: delete `encoder`, `getSecret`, `base64url`, `sign` and `safeEqual`, and add after the header comment:
```ts
import { getSecret, safeEqual, sign } from '@/app/_shared/lib/auth/signing';
```

- [ ] **Step 4: Create `reportLink.ts`**

```ts
// app/_shared/lib/auth/reportLink.ts

// Private links to one audit's PDF report: `${auditId}.${signature}`, signed with
// AUTH_SECRET. Signing "report:<id>" keeps them from ever matching a session
// signature. Rotating AUTH_SECRET turns every link off.

import { getSecret, safeEqual, sign } from '@/app/_shared/lib/auth/signing';

// Audit ids are UUIDs
const AUDIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const signed = (auditId: string) => `report:${auditId}`;

/** The token for an audit's report link; null when AUTH_SECRET isn't set */
export async function reportToken(auditId: string): Promise<string | null> {
  const secret = getSecret();
  return secret ? `${auditId}.${await sign(signed(auditId), secret)}` : null;
}

/** The audit id a valid token is for; null for a missing, malformed or changed token */
export async function verifyReportToken(token: string): Promise<string | null> {
  const secret = getSecret();
  const dot = token.indexOf('.');
  if (!secret || dot === -1) return null;
  const auditId = token.slice(0, dot);
  if (!AUDIT_ID.test(auditId)) return null;
  return safeEqual(token.slice(dot + 1), await sign(signed(auditId), secret)) ? auditId : null;
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/auth && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 2: Shared PDF rendering and the public `/report/{token}` route

**Files:**
- Create: `app/_shared/lib/audit/auditPdf.ts`, `app/report/[token]/route.ts`
- Modify: `app/api/pdf/route.ts`, `app/_shared/lib/config/routes.ts`
- Test: `app/_shared/lib/config/__tests__/routes.test.ts`, `app/report/[token]/__tests__/route.test.ts`, `app/api/pdf/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `verifyReportToken`, `reportToken` (Task 1).
- Produces:
  ```ts
  // routes.ts
  ROUTES.REPORT = '/report'   // public prefix
  API_ROUTES.CRM = '/api/crm'
  // auditPdf.ts
  export type AuditPdfResult = { ok: true; pdf: Buffer; filename: string } | { ok: false; status: 404 | 500; error: string };
  export function renderAuditPdf(auditId: string): Promise<AuditPdfResult>;
  ```

- [ ] **Step 1: Write the failing tests**

`app/_shared/lib/config/__tests__/routes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isProtectedRoute, isPublicRoute, ROUTES } from '@/app/_shared/lib/config/routes';

describe('route access', () => {
  it('opens report links without a login, and nothing else new', () => {
    expect(isPublicRoute(`${ROUTES.REPORT}/abc.def`)).toBe(true);
    expect(isPublicRoute('/reports')).toBe(false);
    expect(isProtectedRoute('/api/crm')).toBe(true);
    expect(isProtectedRoute('/api/pdf')).toBe(true);
    expect(isProtectedRoute(ROUTES.DASHBOARD)).toBe(true);
  });
});
```

`app/report/[token]/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/report/[token]/route';
import { reportToken } from '@/app/_shared/lib/auth/reportLink';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const open = (token: string) => GET(new NextRequest(`http://localhost/report/${token}`), { params: Promise.resolve({ token }) });

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
  vi.mocked(renderAuditPdf).mockReset().mockResolvedValue({ ok: true, pdf: Buffer.from('%PDF-1.4'), filename: 'audit-smile-dental.pdf' });
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /report/[token]', () => {
  it("shows the audit's PDF in the browser for a valid link", async () => {
    const res = await open((await reportToken(AUDIT))!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('inline; filename="audit-smile-dental.pdf"');
    expect(renderAuditPdf).toHaveBeenCalledWith(AUDIT);
  });

  it('answers 404 for a changed link without touching the audit', async () => {
    const res = await open(`${AUDIT}.not-the-signature`);
    expect(res.status).toBe(404);
    expect(renderAuditPdf).not.toHaveBeenCalled();
  });

  it('answers 404 when the audit or its report is gone', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 404, error: 'Audit not found' });
    expect((await open((await reportToken(AUDIT))!)).status).toBe(404);
  });
});
```

`app/api/pdf/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pdf/route';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

vi.mock('@/app/_shared/lib/audit/auditPdf', () => ({ renderAuditPdf: vi.fn() }));

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/pdf', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/pdf', () => {
  it('downloads the rendered PDF as a file', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: true, pdf: Buffer.from('%PDF-1.4'), filename: 'audit-smile-dental.pdf' });
    const res = await post({ audit_id: 'a1' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="audit-smile-dental.pdf"');
  });

  it('passes on why there is no PDF', async () => {
    vi.mocked(renderAuditPdf).mockResolvedValue({ ok: false, status: 404, error: 'AI report not found — generate the report first' });
    const res = await post({ audit_id: 'a1' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('AI report not found — generate the report first');
  });

  it('asks for an audit id', async () => {
    expect((await post({})).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/config app/report app/api/pdf`
Expected: FAIL — `ROUTES.REPORT` undefined (`isPublicRoute('undefined/abc.def')` false) and the `auditPdf` / `report` modules not found.

- [ ] **Step 3: Routes** — in `routes.ts`:
- add to `ROUTES`: `REPORT: '/report',` with the comment `// Private PDF report links (/report/{signed token}) — public, the token is the key`
- add to `API_ROUTES`: `CRM: '/api/crm',`
- `PUBLIC_ROUTES` becomes `[ROUTES.LOGIN, API_ROUTES.AUTH, ROUTES.REPORT] as const;` and its comment: `// Everything is private (single-admin tool) except these; /report/{token} is checked by its signature`

- [ ] **Step 4: Create `auditPdf.ts`** (moved from `/api/pdf`):

```ts
// app/_shared/lib/audit/auditPdf.ts

// An audit's PDF report, built from its stored data and newest AI report. Used
// by the download (/api/pdf) and the private report link (/report/{token}).
// Server-only.

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps } from '@/app/_shared/lib/audit/reportData';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

export type AuditPdfResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: 404 | 500; error: string };

const fileName = (businessName: string) =>
  `audit-${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-')}.pdf`;

export async function renderAuditPdf(auditId: string): Promise<AuditPdfResult> {
  const { data: audit } = await supabase.from('audits').select('*, businesses(*)').eq('id', auditId).single();
  if (!audit) return { ok: false, status: 404, error: 'Audit not found' };

  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aiReport) return { ok: false, status: 404, error: 'AI report not found — generate the report first' };

  const business = audit.businesses as { name: string; website: string | null; address: string; phone: string | null };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, aiReport, reportContact())) as any);
    return { ok: true, pdf, filename: fileName(business.name) };
  } catch {
    return { ok: false, status: 500, error: 'Failed to generate PDF' };
  }
}
```

- [ ] **Step 5: `/api/pdf` uses it** — replace the whole file with:

```ts
// app/api/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const result = await renderAuditPdf(auditId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  });
}
```

- [ ] **Step 6: Create `app/report/[token]/route.ts`**

```ts
// app/report/[token]/route.ts

// The private link to one audit's PDF report, sent with HubSpot leads. Public:
// the signed token is the only key (see lib/auth/reportLink.ts).

import { NextRequest, NextResponse } from 'next/server';
import { verifyReportToken } from '@/app/_shared/lib/auth/reportLink';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

const notFound = () => new NextResponse('Report not found', { status: 404 });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auditId = await verifyReportToken(token);
  if (!auditId) return notFound();

  const result = await renderAuditPdf(auditId);
  if (!result.ok) return result.status === 404 ? notFound() : new NextResponse('Report unavailable', { status: 500 });

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/config app/report app/api/pdf && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 3: The lead payload — properties, industry, note

**Files:**
- Create: `app/_shared/lib/crm/leadPayload.ts`
- Modify: `app/_shared/lib/types/auditely.ts`
- Test: `app/_shared/lib/crm/__tests__/leadPayload.test.ts`

**Interfaces:**
- Consumes: `rankedProblems` (impact.ts), `isOutdatedAudit`.
- Produces:
  ```ts
  // auditely.ts — Business gains:
  hubspot_company_id?: string | null;
  crm_sent_at?: string | null;
  // leadPayload.ts
  export interface LeadInput { business: Pick<Business, 'name' | 'address' | 'website' | 'phone' | 'email' | 'rating' | 'review_count'>; niche: string | null; audit: Audit; report: AiReport; reportUrl: string }
  export interface LeadPayload {
    domain: string | null;
    company: Record<string, string>;
    contact: { email: string; properties: Record<string, string> } | null;
    onCreate: { company: Record<string, string>; contact: Record<string, string> };
    noteHtml: string;
  }
  export function industryFor(niche: string | null): { industry: string | null; group: string };
  export function buildLeadPayload(input: LeadInput): LeadPayload;
  ```

- [ ] **Step 1: Write the failing tests** — create `leadPayload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildLeadPayload, industryFor, type LeadInput } from '@/app/_shared/lib/crm/leadPayload';
import type { AiReport, Audit } from '@/app/_shared/lib/types/auditely';

const audit = (over: Partial<Audit> = {}): Audit => ({
  id: 'a1', business_id: 'b1', created_at: '2026-10-01T09:00:00Z', engine_version: 2,
  performance_score: 61, seo_score: 83, mobile_score: 34, ssl_valid: true, geo_score: 40, aeo_score: null, lead_score: 45,
  raw_json: {},
  checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'x' }], pages: [], links: { checked: 0, broken: [] } } },
  ...over,
});
const report: AiReport = {
  id: 'r1', audit_id: 'a1', created_at: '2026-10-01T09:05:00Z', improvements: [],
  summary: 'Visitors have no easy way to write to you.',
  cold_email: 'Subject: Quick note\n\nHi there,\nYour site has no contact form.',
};
const input = (over: Partial<LeadInput> = {}): LeadInput => ({
  business: { name: 'Smile Dental', address: '123 Main St, Springfield, IL', website: 'https://www.smiledental.com/', phone: '(555) 123-4567', email: 'office@smiledental.com', rating: 4.6, review_count: 123 },
  niche: 'dentists',
  audit: audit(),
  report,
  reportUrl: 'https://auditely.app/report/a1.sig',
  ...over,
});

describe('industryFor', () => {
  it.each([
    ['dentists', 'MEDICAL_PRACTICE', 'Health'],
    ['vet clinic', 'VETERINARY', 'Health'],
    ['private schools', 'EDUCATION_MANAGEMENT', 'Education'],
    ['personal injury lawyer', 'LAW_PRACTICE', 'Legal'],
    ['roofing contractors', 'CONSTRUCTION', 'Home services'],
    ['lawn care', null, 'Other'],
    ['website audits', null, 'Other'],
  ])('maps "%s"', (niche, industry, group) => {
    expect(industryFor(niche)).toEqual({ industry, group });
  });

  it('has no industry without a niche', () => {
    expect(industryFor(null)).toEqual({ industry: null, group: 'Other' });
  });
});

describe('buildLeadPayload', () => {
  it('describes the company, its contact, and the stage for new records only', () => {
    const lead = buildLeadPayload(input());
    expect(lead.domain).toBe('smiledental.com');
    expect(lead.company).toEqual({
      name: 'Smile Dental',
      domain: 'smiledental.com',
      website: 'https://www.smiledental.com/',
      phone: '(555) 123-4567',
      address: '123 Main St, Springfield, IL',
      industry: 'MEDICAL_PRACTICE',
    });
    expect(lead.contact).toEqual({
      email: 'office@smiledental.com',
      properties: { email: 'office@smiledental.com', phone: '(555) 123-4567', website: 'https://www.smiledental.com/', company: 'Smile Dental' },
    });
    expect(lead.onCreate).toEqual({ company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } });
  });

  it('leaves out what is unknown: no email, no phone, no industry', () => {
    const lead = buildLeadPayload(input({ niche: 'lawn care', business: { ...input().business, email: null, phone: null } }));
    expect(lead.contact).toBeNull();
    expect(lead.company).not.toHaveProperty('phone');
    expect(lead.company).not.toHaveProperty('industry');
  });

  it('writes the note: tag, scores, rating, problems, summary, email draft and report link', () => {
    const { noteHtml } = buildLeadPayload(input());
    expect(noteHtml).toContain('Auditely audit lead — Health');
    expect(noteHtml).toContain('Performance 61 · Mobile 34 · SEO 83 · SSL valid · GEO 40 · AEO — · Lead capture 45');
    expect(noteHtml).toContain('Google rating 4.6 from 123 reviews');
    expect(noteHtml).toContain('<li>We found no contact form or email link on your site</li>');
    expect(noteHtml).toContain('Visitors have no easy way to write to you.');
    expect(noteHtml).toContain('Subject: Quick note<br><br>Hi there,<br>Your site has no contact form.');
    expect(noteHtml).toContain('<a href="https://auditely.app/report/a1.sig">PDF report</a>');
  });

  it('shows text from websites and the AI as text, never as markup', () => {
    const { noteHtml } = buildLeadPayload(
      input({ report: { ...report, summary: '<img src=x onerror="alert(1)"> & more' } })
    );
    expect(noteHtml).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more');
    expect(noteHtml).not.toContain('<img');
  });

  it("doesn't trust SEO and SSL from an outdated audit", () => {
    const { noteHtml } = buildLeadPayload(input({ audit: audit({ engine_version: 1, seo_score: 0, ssl_valid: false }) }));
    expect(noteHtml).toContain('SEO — · SSL —');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/crm/__tests__/leadPayload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Types** — in `app/_shared/lib/types/auditely.ts`, in `Business` after `review_count`:
```ts
  /** The HubSpot company this lead was sent to; absent before the HubSpot migration */
  hubspot_company_id?: string | null;
  /** When the lead was last sent to HubSpot */
  crm_sent_at?: string | null;
```

- [ ] **Step 4: Create `leadPayload.ts`**

```ts
// app/_shared/lib/crm/leadPayload.ts

// A lead as a CRM sees it: company and contact fields, and a note with the
// audit. Pure; hubspot.ts sends it.

import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { isOutdatedAudit } from '@/app/_shared/lib/audit/types';
import type { AiReport, Audit, Business } from '@/app/_shared/lib/types/auditely';

export interface LeadInput {
  business: Pick<Business, 'name' | 'address' | 'website' | 'phone' | 'email' | 'rating' | 'review_count'>;
  niche: string | null;
  audit: Audit;
  report: AiReport;
  /** The private PDF link (/report/{token}) */
  reportUrl: string;
}

export interface LeadPayload {
  /** The website's domain, used to find the company again */
  domain: string | null;
  company: Record<string, string>;
  /** Only when the business has an email */
  contact: { email: string; properties: Record<string, string> } | null;
  /** Set only when creating: HubSpot refuses moving a stage backwards */
  onCreate: { company: Record<string, string>; contact: Record<string, string> };
  noteHtml: string;
}

// HubSpot's industry values follow this naming but aren't published; a value
// it rejects is dropped (hubspot.ts). First match wins: vet before "clinic".
const INDUSTRIES: { match: RegExp; industry: string; group: string }[] = [
  { match: /\bvet/, industry: 'VETERINARY', group: 'Health' },
  { match: /dentist|dental|orthodont|clinic|medical|doctor|physician|chiropract|physio|dermatolog|pediatric/, industry: 'MEDICAL_PRACTICE', group: 'Health' },
  { match: /school|academy|tutor|preschool|daycare|college|university|education/, industry: 'EDUCATION_MANAGEMENT', group: 'Education' },
  { match: /lawyer|attorney|law firm|law office|legal/, industry: 'LAW_PRACTICE', group: 'Legal' },
  { match: /restaurant|cafe|bakery/, industry: 'RESTAURANTS', group: 'Food' },
  { match: /roof|plumb|hvac|electric|contractor|construction/, industry: 'CONSTRUCTION', group: 'Home services' },
  { match: /gym|fitness|yoga|\bspa\b|salon/, industry: 'HEALTH_WELLNESS_AND_FITNESS', group: 'Fitness & beauty' },
  { match: /real estate|realtor/, industry: 'REAL_ESTATE', group: 'Real estate' },
  { match: /accountant|accounting|\bcpa\b|bookkeep/, industry: 'ACCOUNTING', group: 'Finance' },
];

export function industryFor(niche: string | null): { industry: string | null; group: string } {
  const rule = niche ? INDUSTRIES.find((r) => r.match.test(niche.toLowerCase())) : undefined;
  return rule ? { industry: rule.industry, group: rule.group } : { industry: null, group: 'Other' };
}

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const score = (value: number | null | undefined) => (typeof value === 'number' ? String(value) : '—');

function domainOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Leaves out empty values
const present = (fields: Record<string, string | null | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => !!entry[1]));

function noteHtml({ business, audit, report, reportUrl }: LeadInput, group: string): string {
  // v1 audits never measured SEO or SSL (their 0 / false meant "unknown")
  const outdated = isOutdatedAudit(audit.engine_version);
  const ssl = outdated || audit.ssl_valid === null ? '—' : audit.ssl_valid ? 'valid' : 'invalid';
  const scores = [
    `Performance ${score(audit.performance_score)}`,
    `Mobile ${score(audit.mobile_score)}`,
    `SEO ${outdated ? '—' : score(audit.seo_score)}`,
    `SSL ${ssl}`,
    `GEO ${score(audit.geo_score)}`,
    `AEO ${score(audit.aeo_score)}`,
    `Lead capture ${score(audit.lead_score)}`,
  ].join(' · ');
  const audited = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rating =
    typeof business.review_count === 'number'
      ? `Google rating ${typeof business.rating === 'number' ? business.rating.toFixed(1) : '—'} from ${business.review_count} reviews`
      : null;
  const problems = rankedProblems(audit).slice(0, 4).map((p) => `<li>${esc(p.problem)}</li>`).join('');

  return [
    `<p><strong>Auditely audit lead — ${esc(group)}</strong></p>`,
    `<p>Audited ${esc(audited)}: ${scores}</p>`,
    rating && `<p>${esc(rating)}</p>`,
    problems && `<p><strong>Top problems</strong></p><ul>${problems}</ul>`,
    `<p><strong>Summary</strong><br>${esc(report.summary)}</p>`,
    `<p><strong>Cold email draft</strong><br>${esc(report.cold_email).replace(/\r?\n/g, '<br>')}</p>`,
    `<p><a href="${esc(reportUrl)}">PDF report</a></p>`,
  ]
    .filter(Boolean)
    .join('');
}

export function buildLeadPayload(input: LeadInput): LeadPayload {
  const { business, niche } = input;
  const { industry, group } = industryFor(niche);
  const domain = domainOf(business.website);

  return {
    domain,
    company: present({
      name: business.name,
      domain,
      website: business.website,
      phone: business.phone,
      address: business.address,
      industry,
    }),
    contact: business.email
      ? {
          email: business.email,
          properties: present({ email: business.email, phone: business.phone, website: business.website, company: business.name }),
        }
      : null,
    onCreate: { company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } },
    noteHtml: noteHtml(input, group),
  };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/crm/__tests__/leadPayload.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 4: The HubSpot client

**Files:**
- Create: `app/_shared/lib/crm/hubspot.ts`
- Test: `app/_shared/lib/crm/__tests__/hubspot.test.ts`

**Interfaces:**
- Consumes: `LeadPayload` (Task 3).
- Produces:
  ```ts
  export class HubSpotError extends Error { status: number; kind: 'auth' | 'rateLimit' | 'other' }
  export interface SentLead { companyId: string; contactId: string | null }
  export function sendLead(token: string, lead: LeadPayload, options: { savedCompanyId: string | null; onCompanySaved: (id: string) => Promise<void> }): Promise<SentLead>;
  export function describeHubSpotError(err: unknown): { status: number; error: string };
  ```

- [ ] **Step 1: Write the failing tests** — create `hubspot.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { describeHubSpotError, HubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';
import type { LeadPayload } from '@/app/_shared/lib/crm/leadPayload';

type Call = { method: string; path: string; body: Record<string, unknown> | null };
type Answer = { status: number; body?: unknown };

// A fake HubSpot: `answer` decides each response; every call is recorded
const calls: Call[] = [];
let answer: (call: Call) => Answer;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const call: Call = { method: init.method ?? 'GET', path: new URL(url).pathname, body: init.body ? JSON.parse(String(init.body)) : null };
  calls.push(call);
  const { status, body } = answer(call);
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
});

const V = '/crm/objects/2026-09';
const lead = (over: Partial<LeadPayload> = {}): LeadPayload => ({
  domain: 'smiledental.com',
  company: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE' },
  contact: { email: 'office@smiledental.com', properties: { email: 'office@smiledental.com', company: 'Smile Dental' } },
  onCreate: { company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } },
  noteHtml: '<p>Audit</p>',
  ...over,
});
// Nothing exists yet: searches find nothing, creates return new ids
const emptyHubSpot = (call: Call): Answer => {
  if (call.path.endsWith('/search')) return { status: 200, body: { total: 0, results: [] } };
  if (call.method === 'POST' && call.path === `${V}/companies`) return { status: 201, body: { id: 'c-new' } };
  if (call.method === 'POST' && call.path === `${V}/contacts`) return { status: 201, body: { id: 'p-new' } };
  if (call.method === 'POST' && call.path === `${V}/notes`) return { status: 201, body: { id: 'n1' } };
  if (call.method === 'PUT') return { status: 200, body: {} };
  return { status: 404, body: { message: 'Not found' } };
};
const send = (l: LeadPayload = lead(), savedCompanyId: string | null = null) => {
  const onCompanySaved = vi.fn(async () => {});
  return { result: sendLead('token-1', l, { savedCompanyId, onCompanySaved }), onCompanySaved };
};
const only = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);

beforeEach(() => {
  calls.length = 0;
  answer = emptyHubSpot;
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendLead', () => {
  it('creates the company and contact as leads, links them, and adds the note to both', async () => {
    const { result, onCompanySaved } = send();
    expect(await result).toEqual({ companyId: 'c-new', contactId: 'p-new' });
    expect(onCompanySaved).toHaveBeenCalledWith('c-new');
    expect(only('POST', `${V}/companies`)[0].body).toEqual({
      properties: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE', lifecyclestage: 'lead' },
    });
    expect(only('POST', `${V}/contacts`)[0].body).toEqual({
      properties: { email: 'office@smiledental.com', company: 'Smile Dental', lifecyclestage: 'lead', hs_lead_status: 'NEW' },
    });
    expect(only('PUT', `${V}/contact/p-new/associations/default/company/c-new`)).toHaveLength(1);
    const note = only('POST', `${V}/notes`)[0].body as { properties: Record<string, string>; associations: unknown[] };
    expect(note.properties.hs_note_body).toBe('<p>Audit</p>');
    expect(note.associations).toEqual([
      { to: { id: 'c-new' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }] },
      { to: { id: 'p-new' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
    ]);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });

  it('updates the saved company and an existing contact without touching their stage', async () => {
    answer = (call) => {
      if (call.method === 'PATCH') return { status: 200, body: { id: call.path.split('/').pop() } };
      if (call.path === `${V}/contacts/search`) return { status: 200, body: { results: [{ id: 'p-old' }] } };
      return emptyHubSpot(call);
    };
    const { result } = send(lead(), 'c-old');
    expect(await result).toEqual({ companyId: 'c-old', contactId: 'p-old' });
    expect(only('PATCH', `${V}/companies/c-old`)[0].body).toEqual({
      properties: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE' },
    });
    expect(only('PATCH', `${V}/contacts/p-old`)[0].body).toEqual({ properties: { email: 'office@smiledental.com', company: 'Smile Dental' } });
    expect(only('POST', `${V}/companies`)).toHaveLength(0);
  });

  it('finds the company by its domain when the saved one was deleted in HubSpot', async () => {
    answer = (call) => {
      if (call.method === 'PATCH' && call.path === `${V}/companies/c-gone`) return { status: 404, body: { message: 'Not found' } };
      if (call.method === 'PATCH') return { status: 200, body: { id: call.path.split('/').pop() } };
      if (call.path === `${V}/companies/search`) return { status: 200, body: { results: [{ id: 'c-domain' }] } };
      return emptyHubSpot(call);
    };
    const { result, onCompanySaved } = send(lead(), 'c-gone');
    expect((await result).companyId).toBe('c-domain');
    expect(onCompanySaved).toHaveBeenCalledWith('c-domain');
    expect(only('POST', `${V}/companies/search`)[0].body).toMatchObject({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: 'smiledental.com' }] }],
    });
  });

  it('saves the company without the industry when HubSpot rejects it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    answer = (call) => {
      const properties = (call.body as { properties?: Record<string, string> } | null)?.properties;
      if (call.path === `${V}/companies` && properties?.industry) return { status: 400, body: { message: 'Property values were not valid' } };
      return emptyHubSpot(call);
    };
    expect((await send().result).companyId).toBe('c-new');
    expect(only('POST', `${V}/companies`)[1].body).toEqual({ properties: { name: 'Smile Dental', domain: 'smiledental.com', lifecyclestage: 'lead' } });
    expect(warn).toHaveBeenCalled();
  });

  it('sends no contact when the business has no email', async () => {
    const { result } = send(lead({ contact: null }));
    expect(await result).toEqual({ companyId: 'c-new', contactId: null });
    expect(calls.some((c) => c.path.includes('/contact'))).toBe(false);
    const note = only('POST', `${V}/notes`)[0].body as { associations: unknown[] };
    expect(note.associations).toHaveLength(1);
  });

  it('has already handed over the company id when a later step fails', async () => {
    answer = (call) => (call.path === `${V}/notes` ? { status: 500, body: { message: 'Internal error' } } : emptyHubSpot(call));
    const { result, onCompanySaved } = send();
    await expect(result).rejects.toBeInstanceOf(HubSpotError);
    expect(onCompanySaved).toHaveBeenCalledWith('c-new');
  });
});

describe('describeHubSpotError', () => {
  it.each([
    [new HubSpotError('bad token', 401, 'auth'), 502, 'HubSpot refused the token — check it has companies and contacts read and write.'],
    [new HubSpotError('missing scopes', 403, 'auth'), 502, 'HubSpot refused the token — check it has companies and contacts read and write.'],
    [new HubSpotError('slow down', 429, 'rateLimit'), 503, 'HubSpot is busy — try again in a minute.'],
    [new HubSpotError('Property values were not valid', 400, 'other'), 502, "HubSpot couldn't save the lead: Property values were not valid"],
    [new TypeError('fetch failed'), 502, "HubSpot couldn't be reached — try again."],
  ])('explains %s', (err, status, error) => {
    expect(describeHubSpotError(err)).toEqual({ status, error });
  });

  it('classifies HubSpot answers by status', async () => {
    answer = () => ({ status: 401, body: { message: 'Authentication credentials not found' } });
    await expect(send().result).rejects.toMatchObject({ kind: 'auth', status: 401 });
    answer = () => ({ status: 429, body: { message: 'You have reached your secondly limit.' } });
    await expect(send().result).rejects.toMatchObject({ kind: 'rateLimit' });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/crm/__tests__/hubspot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `hubspot.ts`**

```ts
// app/_shared/lib/crm/hubspot.ts

// Sends a lead to HubSpot: the company (saved id, else found by website domain,
// else new), the contact (by email), their link, and a note on both.
// Server-only: the token never reaches the browser.

import type { LeadPayload } from '@/app/_shared/lib/crm/leadPayload';

const API = 'https://api.hubapi.com';
// HubSpot's dated API version; one place to move it forward
const OBJECTS = '/crm/objects/2026-09';
const NOTE_TO_COMPANY = 190;
const NOTE_TO_CONTACT = 202;
const TIMEOUT_MS = 15_000;

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'auth' | 'rateLimit' | 'other'
  ) {
    super(message);
  }
}

export interface SentLead {
  companyId: string;
  contactId: string | null;
}

type Call = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function caller(token: string): Call {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return data as T;
    const message = (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rateLimit' : 'other';
    throw new HubSpotError(message, res.status, kind);
  };
}

async function findId(call: Call, object: 'companies' | 'contacts', property: string, value: string): Promise<string | null> {
  const found = await call<{ results?: { id: string }[] }>('POST', `${OBJECTS}/${object}/search`, {
    filterGroups: [{ filters: [{ propertyName: property, operator: 'EQ', value }] }],
    properties: [property],
    limit: 1,
  });
  return found?.results?.[0]?.id ?? null;
}

// Updates (id) or creates the company. HubSpot's industry codes aren't published:
// one it rejects is dropped so the lead still goes through.
async function saveCompany(call: Call, id: string | null, lead: LeadPayload): Promise<string> {
  const write = (properties: Record<string, string>) =>
    id
      ? call<{ id: string }>('PATCH', `${OBJECTS}/companies/${id}`, { properties })
      : call<{ id: string }>('POST', `${OBJECTS}/companies`, { properties: { ...properties, ...lead.onCreate.company } });
  try {
    return (await write(lead.company)).id;
  } catch (err) {
    if (!(err instanceof HubSpotError) || err.status !== 400 || !lead.company.industry) throw err;
    console.warn('[hubspot] industry rejected, saving without it:', lead.company.industry, err.message);
    return (await write(Object.fromEntries(Object.entries(lead.company).filter(([key]) => key !== 'industry')))).id;
  }
}

async function upsertCompany(call: Call, lead: LeadPayload, savedId: string | null): Promise<string> {
  if (savedId) {
    try {
      return await saveCompany(call, savedId, lead);
    } catch (err) {
      // Deleted in HubSpot since the last send: find it by domain or create it
      if (!(err instanceof HubSpotError) || err.status !== 404) throw err;
    }
  }
  const found = lead.domain ? await findId(call, 'companies', 'domain', lead.domain) : null;
  return saveCompany(call, found, lead);
}

async function upsertContact(call: Call, contact: NonNullable<LeadPayload['contact']>, onCreate: Record<string, string>): Promise<string> {
  const id = await findId(call, 'contacts', 'email', contact.email);
  const saved = id
    ? await call<{ id: string }>('PATCH', `${OBJECTS}/contacts/${id}`, { properties: contact.properties })
    : await call<{ id: string }>('POST', `${OBJECTS}/contacts`, { properties: { ...contact.properties, ...onCreate } });
  return saved.id;
}

const noteLink = (id: string, associationTypeId: number) => ({
  to: { id },
  types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }],
});

/**
 * Sends the lead. `onCompanySaved` runs as soon as the company exists, so a
 * failure in a later step can't cause a duplicate company on the next send.
 */
export async function sendLead(
  token: string,
  lead: LeadPayload,
  options: { savedCompanyId: string | null; onCompanySaved: (id: string) => Promise<void> }
): Promise<SentLead> {
  const call = caller(token);
  const companyId = await upsertCompany(call, lead, options.savedCompanyId);
  await options.onCompanySaved(companyId);

  const contactId = lead.contact ? await upsertContact(call, lead.contact, lead.onCreate.contact) : null;
  if (contactId) await call('PUT', `${OBJECTS}/contact/${contactId}/associations/default/company/${companyId}`);

  await call('POST', `${OBJECTS}/notes`, {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: lead.noteHtml },
    associations: [noteLink(companyId, NOTE_TO_COMPANY), ...(contactId ? [noteLink(contactId, NOTE_TO_CONTACT)] : [])],
  });
  return { companyId, contactId };
}

/** The status and message for the "Send to HubSpot" button */
export function describeHubSpotError(err: unknown): { status: number; error: string } {
  if (!(err instanceof HubSpotError)) return { status: 502, error: "HubSpot couldn't be reached — try again." };
  if (err.kind === 'auth') return { status: 502, error: 'HubSpot refused the token — check it has companies and contacts read and write.' };
  if (err.kind === 'rateLimit') return { status: 503, error: 'HubSpot is busy — try again in a minute.' };
  return { status: 502, error: `HubSpot couldn't save the lead: ${err.message}` };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/crm && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 5: `/api/crm` and the migration

**Files:**
- Create: `app/api/crm/route.ts`, `docs/migrations/2026-10-01-hubspot.sql`
- Modify: `docs/supabase-schema.sql`
- Test: `app/api/crm/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `reportToken` (Task 1), `ROUTES.REPORT` (Task 2), `buildLeadPayload` (Task 3), `sendLead`, `describeHubSpotError` (Task 4), `BUSINESS_WITH_AUDIT`, `withAuditData`.
- Produces: `POST /api/crm { business_id }` → `200 { crm_sent_at }` or `{ error }` with the spec's statuses.

- [ ] **Step 1: Write the failing tests** — create `app/api/crm/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/crm/route';
import { HubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';

// Fake Supabase: the business (with its audit, report and search) and every update
const db = vi.hoisted(() => {
  const state = { business: null as unknown, updates: [] as Record<string, unknown>[] };
  const from = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: state.business, error: null }),
      update: (value: Record<string, unknown>) => {
        state.updates.push(value);
        return { eq: async () => ({ error: null }) };
      },
    };
    return chain;
  };
  return { state, from };
});

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/crm/hubspot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/crm/hubspot')>()),
  sendLead: vi.fn(),
}));

const AUDIT = '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f';
const businessRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Smile Dental', address: '1 Main St', website: 'https://smiledental.com', phone: null, email: null,
  rating: null, review_count: null, hubspot_company_id: 'c-old', searches: { niche: 'dentists' },
  audits: {
    id: AUDIT, business_id: 'b1', created_at: '2026-10-01T00:00:00Z', engine_version: 2, performance_score: 50, seo_score: 80,
    mobile_score: 40, ssl_valid: true, geo_score: null, aeo_score: null, lead_score: null, raw_json: {}, checks: {},
    ai_reports: { id: 'r1', audit_id: AUDIT, summary: 'S', improvements: [], cold_email: 'E', created_at: '2026-10-01T00:00:00Z' },
  },
  ...over,
});

const post = (body: unknown) =>
  POST(new NextRequest('https://auditely.app/api/crm', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('HUBSPOT_TOKEN', 'token-1');
  vi.stubEnv('AUTH_SECRET', 'a'.repeat(40));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.business = businessRow();
  db.state.updates = [];
  // args[2] is sendLead's options: the route's onCompanySaved
  vi.mocked(sendLead).mockReset().mockImplementation(async (...args) => {
    await args[2].onCompanySaved('c-old');
    return { companyId: 'c-old', contactId: null };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/crm', () => {
  it('sends the lead with a private report link and records the send', async () => {
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(200);
    const [token, lead, options] = vi.mocked(sendLead).mock.calls[0];
    expect(token).toBe('token-1');
    expect(lead.noteHtml).toMatch(new RegExp(`href="https://auditely\\.app/report/${AUDIT}\\.[A-Za-z0-9_-]+"`));
    expect(lead.company.industry).toBe('MEDICAL_PRACTICE');
    expect(options.savedCompanyId).toBe('c-old');
    expect(db.state.updates[0]).toEqual({ hubspot_company_id: 'c-old' });
    expect(db.state.updates[1]).toHaveProperty('crm_sent_at');
    expect((await res.json()).crm_sent_at).toBe(db.state.updates[1].crm_sent_at);
  });

  it('keeps the company id but records no send when a later step fails', async () => {
    vi.mocked(sendLead).mockImplementation(async (...args) => {
      await args[2].onCompanySaved('c-new');
      throw new HubSpotError('Internal error', 500, 'other');
    });
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("HubSpot couldn't save the lead: Internal error");
    expect(db.state.updates).toEqual([{ hubspot_company_id: 'c-new' }]);
  });

  it('asks for the audit and summary first', async () => {
    db.state.business = businessRow({ audits: null });
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Run the audit and AI summary first.');
    expect(sendLead).not.toHaveBeenCalled();
  });

  it('explains when HubSpot is not connected', async () => {
    vi.stubEnv('HUBSPOT_TOKEN', '');
    const res = await post({ business_id: 'b1' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("HubSpot isn't connected — add HUBSPOT_TOKEN in Vercel.");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/api/crm/__tests__/route.test.ts`
Expected: FAIL — `Cannot find package '@/app/api/crm/route'`.

- [ ] **Step 3: Create `app/api/crm/route.ts`**

```ts
// app/api/crm/route.ts

// "Send to HubSpot": the lead, its audit and a private PDF link go to HubSpot.
// The company id is saved as soon as HubSpot has it, so a retry after a later
// failure updates that company instead of creating another.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';
import { reportToken } from '@/app/_shared/lib/auth/reportLink';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { buildLeadPayload } from '@/app/_shared/lib/crm/leadPayload';
import { describeHubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessId: string = typeof body.business_id === 'string' ? body.business_id : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return NextResponse.json({ error: "HubSpot isn't connected — add HUBSPOT_TOKEN in Vercel." }, { status: 503 });

  const { data } = await supabase.from('businesses').select(`${BUSINESS_WITH_AUDIT}, searches (niche)`).eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const row = data as BusinessRow & { searches?: { niche: string } | null };
  const business = withAuditData(row);
  if (!business.audit || !business.ai_report) {
    return NextResponse.json({ error: 'Run the audit and AI summary first.' }, { status: 400 });
  }

  const linkToken = await reportToken(business.audit.id);
  if (!linkToken) return NextResponse.json({ error: 'AUTH_SECRET is not configured' }, { status: 503 });

  const lead = buildLeadPayload({
    business,
    niche: row.searches?.niche ?? null,
    audit: business.audit,
    report: business.ai_report,
    reportUrl: `${request.nextUrl.origin}${ROUTES.REPORT}/${linkToken}`,
  });

  try {
    await sendLead(token, lead, {
      savedCompanyId: business.hubspot_company_id ?? null,
      onCompanySaved: async (companyId) => {
        await supabase.from('businesses').update({ hubspot_company_id: companyId }).eq('id', businessId);
      },
    });
  } catch (err) {
    console.error('[crm] HubSpot send failed:', err instanceof Error ? err.message : err);
    const { status, error } = describeHubSpotError(err);
    return NextResponse.json({ error }, { status });
  }

  const sentAt = new Date().toISOString();
  await supabase.from('businesses').update({ crm_sent_at: sentAt }).eq('id', businessId);
  return NextResponse.json({ crm_sent_at: sentAt });
}
```

- [ ] **Step 4: Migration and schema doc**

Create `docs/migrations/2026-10-01-hubspot.sql`:
```sql
-- 2026-10-01 HubSpot hand-off migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE using "Send to HubSpot".

-- The HubSpot company a lead was sent to (so re-sending updates it), and when.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_sent_at        TIMESTAMPTZ;
```

In `docs/supabase-schema.sql`, in `CREATE TABLE … businesses`, after `review_count        INTEGER,` add:
```sql
  -- The HubSpot company this lead was sent to, and when
  hubspot_company_id  TEXT,
  crm_sent_at         TIMESTAMPTZ,
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/api/crm && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 6: The "Send to HubSpot" button

**Files:**
- Create: `app/_shared/lib/hooks/useCrmSend.ts`, `app/_shared/components/auditely/reportActions/reportActions.tsx`
- Modify: `app/_shared/components/auditely/auditPanel/auditPanel.tsx`

**Interfaces:**
- Consumes: `API_ROUTES.CRM` (Task 2), `Business.crm_sent_at` (Task 3).
- Produces: `useCrmSend(business)` → `{ sentAt, sending, error, send }`; `<ReportActions business state />`.

No unit test: the project's tests run in Node without a DOM library (adding one would be a new dependency). The behavior behind the button is covered by Task 5's route tests; this task is checked by `tsc`, `lint`, `build` and Task 7's running-app check.

- [ ] **Step 1: Create `useCrmSend.ts`**

```ts
// app/_shared/lib/hooks/useCrmSend.ts

'use client';

import { useCallback, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { Business } from '@/app/_shared/lib/types/auditely';

/** "Send to HubSpot" for one lead: when it was last sent, and the send in progress */
export function useCrmSend(business: Business) {
  const [sentAt, setSentAt] = useState<string | null>(business.crm_sent_at ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.CRM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send to HubSpot");
      setSentAt(data.crm_sent_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send to HubSpot");
    } finally {
      setSending(false);
    }
  }, [business.id]);

  return { sentAt, sending, error, send };
}
```

- [ ] **Step 2: Create `reportActions.tsx`** (the audit panel's footer, moved and extended):

```tsx
// app/_shared/components/auditely/reportActions/reportActions.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { DownloadIcon } from '@/app/_shared/components/ui/icons/icons';
import { useCrmSend } from '@/app/_shared/lib/hooks/useCrmSend';
import type { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import type { Business } from '@/app/_shared/lib/types/auditely';

interface ReportActionsProps {
  business: Business;
  state: ReturnType<typeof useBusinessAudit>;
}

const sentOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Once the AI report exists: send the lead to HubSpot, or download its PDF */
export function ReportActions({ business, state }: ReportActionsProps) {
  const crm = useCrmSend(business);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-5 py-3 sm:px-6">
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {crm.error ? (
          <span className="text-red-600 dark:text-red-400">{crm.error}</span>
        ) : crm.sentAt ? (
          `Sent to HubSpot · ${sentOn(crm.sentAt)}`
        ) : (
          'A branded PDF of this audit, ready to send.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={crm.send} isLoading={crm.sending}>
          {crm.sending ? 'Sending…' : crm.sentAt ? 'Send again' : 'Send to HubSpot'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={state.downloadPdf}
          isLoading={state.pdfLoading}
          leftIcon={<DownloadIcon size={14} />}
        >
          {state.pdfLoading ? 'Preparing PDF…' : 'Download PDF report'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Use it in the audit panel** — in `auditPanel.tsx`:
- add `import { ReportActions } from '@/app/_shared/components/auditely/reportActions/reportActions';`
- replace the whole `{report && ( <div className="flex flex-wrap items-center justify-between gap-3 border-t …"> … </div> )}` block with:
```tsx
      {report && <ReportActions business={business} state={state} />}
```
- remove `DownloadIcon` from its icons import and `pdfLoading` from its `state` destructuring if they're no longer used there.

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint warnings.

---

### Task 7: Verify end to end, hand off

**Files:** none (scratch only).

- [ ] **Step 1: Full verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all tests pass (3 pre-existing skips), no type errors, no lint warnings, build succeeds.

- [ ] **Step 2: Check the login rules in the running app** (no database or HubSpot calls)

Run `npx next dev -p 3100` in the background (`next start` doesn't serve the `output: 'standalone'` build; port 3100 avoids the user's own dev server), wait for "Ready", then:
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/report/not-a-real-token      # expected 404 (public, refused by signature)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3100/api/crm -d '{}'       # expected 401 (still private)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/dashboard                     # expected 307 (redirect to login)
```
Stop the server afterwards.

- [ ] **Step 3: Hand-off (do not commit yet)**

Report: what changed, test results, the login check, and the user's setup steps from the spec (HubSpot private app with the 4 scopes, `HUBSPOT_TOKEN` in Vercel, the migration). Offer to watch the first live send together. Ask for the go-ahead to commit code, spec and plan on `staging`; commit only after a yes, ending the message with:
```
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
