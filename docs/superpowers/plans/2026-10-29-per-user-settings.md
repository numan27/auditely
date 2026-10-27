# Per-user Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each account's reports, AI emails and outreach emails carry its own name instead of DevArtVentures'. Paid accounts send from their own mailbox and hand leads to their own HubSpot. Free accounts get Auditely's neutral branding, plus "Open in Gmail/Outlook" for sending.

**Architecture:**
- **Brand.** A pure `resolveBrand` turns an account's profile and plan into one `Brand`: its name, contact details, logo and the AI writer's sign-off. A server `brandFor(userId)` reads the profile and feeds it in. The AI prompt, the PDF and the outreach email all take that `Brand` in place of today's hard-coded DevArtVentures details. The owner's brand falls back to today's DevArtVentures values field by field, so with a blank profile nothing the owner sends changes.
- **Secrets.** Mailbox passwords and HubSpot tokens are encrypted with AES-256-GCM under `SECRETS_KEY` and kept in a `user_secrets` table that only the service role can touch.
- **Settings page.** A `/settings` page edits all of it. A `ConnectionsProvider` tells the report actions what each account can do.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.2.3, `@supabase/supabase-js` 2.118, nodemailer, @react-pdf/renderer, vitest 5, Tailwind 4. Node's `crypto` (AES-256-GCM), `dns.promises` and `net.BlockList`. Postgres 17 is installed locally (`/usr/local/opt/postgresql@17/bin`) for the migration's scratch check.

**Spec:** `docs/superpowers/specs/2026-10-27-public-launch-design.md`. This plan is Phase 3, "Per-user settings". Phases 1 and 2 are merged to `main` and live.

## Scope

**In Phase 3:**
- profile and report branding: the AI prompt, the PDF and the outreach email take the account's details;
- "Write again" on a summary;
- your own mailbox (SMTP with an app password) and your own HubSpot token, both stored encrypted;
- Free's "Open in Gmail" and "Open in Outlook";
- the `/settings` page (profile, mailbox, HubSpot, plan) and a link to it in the header.

**Not in Phase 3:**
- Billing and the Stripe customer portal in Settings: Phase 4. Until then the Plan section links to `/plans`.
- The public free audit (which uses the Auditely brand built here), the landing page, and the look of `/demo`: Phase 5. `/demo` and its PDFs stay exactly as they are today (ruling 2).

**Rulings this plan makes (flag them in review):**
1. **The logo is stored as a data URL** (`profiles.logo_data_url`: PNG or JPEG, at most 256 KB). The spec says "logo URL". A URL would mean fetching someone else's address from the server when each PDF is drawn, which is an SSRF risk, and a bucket would need Storage setup. A small data URL needs neither.
2. **`/demo` keeps today's DevArtVentures look**, `DEMO_PDF_CONTACT` included. The owner links it from Upwork today, and its saved sample emails are signed "Numan, DevArtVentures". Phase 5 decides what the demo shows once the landing page links to it.
3. **The "Upwork PDF" button is shown to the owner only.** It's the owner's workflow, and its name means nothing to anyone else.
4. **The neutral sign-off is "[Your name]".** Free and blank-profile reports tell the AI to sign off with "[Your name]", which the user replaces before sending.
5. **Verifalia for paid accounts runs once, at send time.** The send route already checks the address before it sends. Only the owner's dialog also checks when it opens (as today), so opening the dialog and not sending spends nothing.
6. **The owner's saved mailbox or HubSpot token wins over the Vercel variables.** Without one, the owner keeps today's environment setup.

## Global Constraints

**Plans (spec, Plans, verbatim):**

| | Free | Pro | Agency |
|---|---|---|---|
| PDF report | Auditely footer | Your branding | Your branding |
| Send from your mailbox | — | ✓ | ✓ |
| HubSpot handoff | — | ✓ | ✓ |

**Spec decisions this phase carries out:**
- "Whose name is on it": a Free user's report and email say "Audited with Auditely" and invite the reader to try Auditely. Nothing outside the owner's account mentions DevArtVentures.
- "PDF report branding": Free gets Auditely's footer and sign-up invitation. Paid gets your name, logo, contact and booking link. The owner's account carries today's DevArtVentures details as its profile.
- "AI summary and cold email": the prompt takes the user's name and company from their profile, and Free and blank profiles get a neutral sign-off. Changing the profile applies to reports written from then on. "Write again" redoes an old one.
- "Sending outreach email": Free gets "Copy email" and "Open in Gmail/Outlook". Paid connects their own mailbox (an SMTP app password), stored encrypted.
- "HubSpot": paid users each paste their own private-app token, stored encrypted.
- "Secrets at rest": AES-256-GCM with a server key (`SECRETS_KEY`), never sent back to the browser. No API response, page prop or log line carries a password, a token or ciphertext.
- "Email verification (Verifalia)": paid plans only, one check per email sent.

**Code rules (unchanged from Phase 2):**
- `serviceDb` stays in the files listed in `app/__tests__/serviceDbUsage.test.ts`. This plan adds exactly two: `app/_shared/lib/brand/brand.ts` and `app/_shared/lib/secrets/userSecrets.ts`.
- UI copy:
  - sentence case and plain verbs;
  - errors say what happened and what to do next, with no apologies;
  - no `→` in link text.
- Tests use vitest with fake clients. Never connect to the real Supabase project, a real mailbox or HubSpot.
- Code follows the file around it: the comment density, the `// app/...` path header line, and the `@/app/...` imports. Comment out, never delete, pages and components.
- Commit messages: `feat:` plus what the user now gets, in plain English, ending with the attribution trailer the dispatch gives.

## Review Focus

1. **A Free account's report, AI prompt and emails never say DevArtVentures.** That covers:
   - the full PDF;
   - the prompt;
   - the follow-up and its sign-off;
   - the modal note;
   - the crawler's user agent.

   Task 2 pins the brand, Task 4 the prompt, Task 5 the PDF text (searched case-insensitively for "devart"), and Task 9 the drafts.
2. **The owner with a blank profile sends exactly what they send today.** That covers:
   - the prompt's first line and sign-off;
   - the PDF's "Prepared by DevArtVentures" and "Powered by devartventures.com";
   - the email's name, tagline, four-colour stripe, logo and "free 30-minute call".

   Tasks 2, 4 and 5 compare against today's strings.
3. **Code deployed before the settings migration has run.**
   - The owner's PDFs, AI writing, sending and HubSpot keep working on the environment setup.
   - `select('*')` on profiles returns no new columns, and a missing `user_secrets` table reads as "nothing saved".
   - Saving settings answers 503, never a crash.

   Tasks 3, 6 and 8 pin this.
4. **A mailbox server that points inside the network.**
   - The following are all refused before any connection is opened: `127.0.0.1`, `10.0.0.5`, `169.254.169.254`, `::1`, `::ffff:10.0.0.1`, `localhost`, `mail.internal`, and a public-looking name that resolves to `192.168.1.10`.
   - The connection then uses the address that was checked, so a second DNS answer can't swap it.

   Task 6 pins this.
5. **Ciphertext moved to another account or kind, or read with another key**, fails closed with "can't be read" and never decrypts. Task 6 pins this.

---

### Task 1: Plan features and their copy

**Files:**
- Modify: `app/_shared/lib/usage/plans.ts`, `app/_shared/lib/usage/usageCopy.ts`, `app/_shared/components/auditely/plansView/plansView.tsx`
- Test: `app/_shared/lib/usage/__tests__/plans.test.ts`, `app/_shared/lib/usage/__tests__/usageCopy.test.ts`, `app/_shared/components/auditely/__tests__/plansView.test.ts`

**Interfaces:**
- Produces:
  - `type Feature = 'auditAll' | 'export' | 'branding' | 'mailbox' | 'hubspot'`. The three new features are false on `free` and true on `pro`, `agency` and `owner`.
  - `FEATURE_NAMES` gains:
    - `branding: 'Your own branding on reports'`;
    - `mailbox: 'Sending from your own mailbox'`;
    - `hubspot: 'The HubSpot handoff'`.

    `featureMessage(feature)` keeps its form: "X comes with the Pro and Agency plans."
  - The `FEATURES` list in `plansView.tsx` gains, in this order after the existing two:
    - `branding` 'Your name and logo on reports';
    - `mailbox` 'Send from your mailbox';
    - `hubspot` 'HubSpot handoff'.

- [ ] **Step 1: Write the failing tests**

```ts
// plans.test.ts
it('keeps branding, mailbox and HubSpot for paid plans and the owner', () => {
  for (const f of ['branding', 'mailbox', 'hubspot'] as const) {
    expect(planHas('free', f)).toBe(false);
    expect([planHas('pro', f), planHas('agency', f), planHas('owner', f)]).toEqual([true, true, true]);
  }
});
// usageCopy.test.ts
it('names the new features', () => {
  expect(featureMessage('mailbox')).toBe('Sending from your own mailbox comes with the Pro and Agency plans.');
  expect(featureMessage('hubspot')).toBe('The HubSpot handoff comes with the Pro and Agency plans.');
  expect(featureMessage('branding')).toBe('Your own branding on reports comes with the Pro and Agency plans.');
});
// plansView.test.ts
it('lists branding, mailbox and HubSpot as paid features', () => {
  const html = render(/* the file's existing helper, Free summary */);
  for (const label of ['Your name and logo on reports', 'Send from your mailbox', 'HubSpot handoff']) expect(html).toContain(label);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/usage app/_shared/components/auditely/__tests__/plansView.test.ts`
Expected: FAIL. The new features are type errors or undefined.

- [ ] **Step 3: Add the three features** to `Feature`, each plan's `features`, `FEATURE_NAMES` and `FEATURES`.

- [ ] **Step 4: Run them and watch them pass**, then run `npx tsc --noEmit`. Expected: PASS, and no type errors (any `Record<Feature, …>` that now misses keys gets them).

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/usage app/_shared/components/auditely/plansView app/_shared/components/auditely/__tests__/plansView.test.ts
git commit -m "feat: the plans page lists your own branding, mailbox and HubSpot as Pro and Agency features"
```

---

### Task 2: Brand rules and profile input

**Files:**
- Create:
  - `app/_shared/lib/config/site.ts`
  - `app/_shared/lib/brand/brandRules.ts`
  - `app/_shared/lib/brand/profileInput.ts`
  - `app/_shared/lib/utils/shortUrl.ts`
- Modify: `app/_shared/lib/audit/siteFetch.ts:9` (the user agent names `AUDITELY_URL`), `app/_shared/lib/email/outreachEmail.ts` (import `shortUrl` instead of its local copy)
- Test: `app/_shared/lib/brand/__tests__/brandRules.test.ts`, `app/_shared/lib/brand/__tests__/profileInput.test.ts`

**Interfaces:**
- Consumes:
  - `PdfContact` from `pdfDocument.tsx`;
  - `PlanId`, `planHas` from `plans.ts`;
  - `reportContact()` from `config/reportContact.ts`.
- Produces:
  - `site.ts` (client-safe): `AUDITELY_NAME = 'Auditely'` and `AUDITELY_URL = 'https://auditely.vercel.app'`.
  - `shortUrl.ts`: `shortUrl(website: string): string`. This is the existing body from `outreachEmail.ts`: it drops the scheme, a leading `www.` and a trailing `/`.
  - `brandRules.ts` (pure, no I/O; server and tests):
    - `type BrandKind = 'owner' | 'account' | 'auditely'`
    - `interface BrandLogo { contentType: 'image/png' | 'image/jpeg'; dataUrl: string }`
    - `interface ReportWriter { about: string; signOff: string }`
    - `interface Profile { email: string; display_name: string | null; company: string | null; website: string | null; logo_data_url: string | null; contact_email: string | null; contact_phone: string | null; booking_url: string | null }`
    - `interface Brand { kind: BrandKind; name: string; website: string | null; tagline: string | null; stripe: readonly string[] | null; logo: BrandLogo | null; contact: PdfContact | null; call: string; writer: ReportWriter }`
    - `OWNER_BRAND`, which holds today's values:
      - `name 'DevArtVentures'`, `website 'https://devartventures.com'`;
      - `tagline 'Web engineering for growing businesses'`;
      - `stripe ['#2fbf7d', '#3e9feb', '#ec6a45', '#f9cf6e']`;
      - `about 'DevArtVentures, a web agency'`.

      `outreachEmail.ts` and `pdfDocument.tsx` drop their own copies in Task 5.
    - `resolveBrand(input: { profile: Profile | null; isOwner: boolean; plan: PlanId }, ownerContact: PdfContact = reportContact()): Brand`
    - `logoFromDataUrl(dataUrl: string | null): BrandLogo | null`: the contentType read from a stored, already-validated data URL.
  - `profileInput.ts` (client-safe):
    - `type ProfileFields = Omit<Profile, 'email'>`
    - `parseProfileInput(body: unknown): { ok: true; profile: ProfileFields } | { ok: false; field: keyof ProfileFields; error: string }`
    - `LOGO_MAX_BYTES = 256 * 1024`
    - `logoProblem(dataUrl: string): string | null`

**`resolveBrand` rules:**

| Case | kind | name | website | tagline, stripe | logo | contact | call | writer.about | writer.signOff |
|---|---|---|---|---|---|---|---|---|---|
| `isOwner` | `owner` | company ?? 'DevArtVentures' | profile.website ?? DevArt site | DevArt's while company is blank, else null | profile logo | each field: the profile's ?? `ownerContact`'s, with `name` coming from `display_name` | 'a free 30-minute call' | company ?? 'DevArtVentures, a web agency' | sender = display_name ?? ownerContact.name. With a sender: `${sender}, ${name}`. Without: `The ${name} team` |
| `planHas(plan, 'branding')` and company or display_name set | `account` | company ?? display_name | profile.website | null | profile logo | `{ name: display_name, phone: contact_phone, email: contact_email ?? profile.email, bookingUrl: booking_url }` | 'a free call' | company ?? `${display_name}, a web consultant` | both set: `${display_name}, ${company}`. Company only: `The ${company} team`. Name only: display_name |
| anything else (Free, a blank paid profile, no profile) | `auditely` | 'Auditely' | `AUDITELY_URL` | null | null | null | 'a free call' | 'a web consultant' | '[Your name]' |

**`parseProfileInput` rules:**
- Every field is trimmed, and blank becomes null. A missing key also becomes null (the form always sends the whole profile).
- **Your name and company:** at most 80 characters, with no line breaks. Error: `${label} can be at most 80 characters.`
- **Website and booking link:** a value with no scheme gets `https://`. It must parse as an `http:` or `https:` URL and be at most 200 characters. Error: `${label} must be a web address, like https://example.com.`
- **Contact email:** must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and be at most 120 characters. Error: `Contact email must be an email address, like you@example.com.`
- **Phone:** at most 40 characters, only `0-9 + ( ) - .` and spaces. Error: `Phone can only have digits, spaces and + ( ) - .`
- **Logo:** null, or a value `logoProblem` passes.
- The labels are 'Your name', 'Company', 'Website', 'Booking link'.
- **`logoProblem`:**
  - The value must match `^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$`.
  - It must decode to at most `LOGO_MAX_BYTES`.
  - It must start with the PNG signature `89 50 4E 47 0D 0A 1A 0A`, or with `FF D8 FF` for JPEG.
  - Otherwise: `The logo must be a PNG or JPEG under 256 KB.` SVG is refused, so no script can ride into an email or PDF.

- [ ] **Step 1: Write the failing tests**

```ts
// brandRules.test.ts
const contact = { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/devart-ventures/30min' };
const blank: Profile = { email: 'a@x.com', display_name: null, company: null, website: null, logo_data_url: null, contact_email: null, contact_phone: null, booking_url: null };

it('gives the owner with a blank profile exactly today’s DevArtVentures details', () => {
  const b = resolveBrand({ profile: blank, isOwner: true, plan: 'owner' }, contact);
  expect(b).toMatchObject({ kind: 'owner', name: 'DevArtVentures', website: 'https://devartventures.com',
    tagline: 'Web engineering for growing businesses', contact, call: 'a free 30-minute call',
    writer: { about: 'DevArtVentures, a web agency', signOff: 'Numan, DevArtVentures' } });
  expect(b.stripe).toEqual(['#2fbf7d', '#3e9feb', '#ec6a45', '#f9cf6e']);
  expect(resolveBrand({ profile: blank, isOwner: true, plan: 'owner' }, { ...contact, name: null }).writer.signOff).toBe('The DevArtVentures team');
});
it('lets the owner’s profile replace a default field by field', () => {
  const b = resolveBrand({ profile: { ...blank, display_name: 'Sam', contact_phone: '+1 555 0100' }, isOwner: true, plan: 'owner' }, contact);
  expect(b.contact).toEqual({ ...contact, name: 'Sam', phone: '+1 555 0100' });
  expect(b.writer.signOff).toBe('Sam, DevArtVentures');
  const renamed = resolveBrand({ profile: { ...blank, company: 'Acme' }, isOwner: true, plan: 'owner' }, contact);
  expect([renamed.name, renamed.tagline, renamed.stripe, renamed.writer.about]).toEqual(['Acme', null, null, 'Acme']);
});
it('brands a paid account with its own details', () => {
  const p = { ...blank, display_name: 'Sam Lee', company: 'Acme Studio', website: 'https://acme.studio' };
  const b = resolveBrand({ profile: p, isOwner: false, plan: 'pro' }, contact);
  expect(b).toMatchObject({ kind: 'account', name: 'Acme Studio', call: 'a free call',
    contact: { name: 'Sam Lee', phone: null, email: 'a@x.com', bookingUrl: null },
    writer: { about: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' } });
  expect(resolveBrand({ profile: { ...blank, company: 'Acme' }, isOwner: false, plan: 'agency' }, contact).writer.signOff).toBe('The Acme team');
  expect(resolveBrand({ profile: { ...blank, display_name: 'Sam' }, isOwner: false, plan: 'pro' }, contact).writer)
    .toEqual({ about: 'Sam, a web consultant', signOff: 'Sam' });
});
it('gives Free, a blank paid profile and no profile the Auditely brand, with nothing of DevArtVentures', () => {
  for (const input of [{ profile: { ...blank, company: 'Acme' }, isOwner: false, plan: 'free' as const },
                       { profile: blank, isOwner: false, plan: 'pro' as const },
                       { profile: null, isOwner: false, plan: 'free' as const }]) {
    const b = resolveBrand(input, contact);
    expect(b).toMatchObject({ kind: 'auditely', name: 'Auditely', website: 'https://auditely.vercel.app', contact: null, logo: null,
      writer: { about: 'a web consultant', signOff: '[Your name]' } });
    expect(JSON.stringify(b).toLowerCase()).not.toContain('devart');
  }
});
// profileInput.test.ts
const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString('base64')}`;
it('trims, nulls blanks and adds https:// to a bare website', () => {
  expect(parseProfileInput({ display_name: '  Sam ', company: '', website: 'acme.studio', booking_url: ' ' }))
    .toEqual({ ok: true, profile: { display_name: 'Sam', company: null, website: 'https://acme.studio/', logo_data_url: null,
      contact_email: null, contact_phone: null, booking_url: null } });
});
it('names the field that is wrong', () => {
  expect(parseProfileInput({ company: 'x'.repeat(81) })).toEqual({ ok: false, field: 'company', error: 'Company can be at most 80 characters.' });
  expect(parseProfileInput({ website: 'javascript:alert(1)' })).toMatchObject({ field: 'website', error: 'Website must be a web address, like https://example.com.' });
  expect(parseProfileInput({ contact_email: 'sam@' })).toMatchObject({ field: 'contact_email' });
  expect(parseProfileInput({ contact_phone: '555<script>' })).toMatchObject({ field: 'contact_phone' });
});
it('takes a small PNG or JPEG logo and refuses anything else', () => {
  expect(logoProblem(png)).toBeNull();
  expect(logoProblem(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`)).toBeNull();
  const refused = 'The logo must be a PNG or JPEG under 256 KB.';
  expect(logoProblem('data:image/svg+xml;base64,PHN2Zz4=')).toBe(refused);
  expect(logoProblem(png.replace('image/png', 'image/jpeg'))).toBe(refused); // the bytes say PNG
  expect(logoProblem(`data:image/png;base64,${Buffer.concat([Buffer.from(png.split(',')[1], 'base64'), Buffer.alloc(256 * 1024)]).toString('base64')}`)).toBe(refused);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/brand`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement `site.ts`, `shortUrl.ts`, `brandRules.ts` and `profileInput.ts`** as specified. Then point `USER_AGENT` at `AUDITELY_URL` (`Mozilla/5.0 (compatible; Auditely/1.0; +https://auditely.vercel.app)`) and update any test that pins the old agent.

- [ ] **Step 4: Run `npx vitest run app/_shared/lib/brand app/_shared/lib/audit app/_shared/lib/email`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/config/site.ts app/_shared/lib/brand app/_shared/lib/utils/shortUrl.ts app/_shared/lib/audit/siteFetch.ts app/_shared/lib/email/outreachEmail.ts app/_shared/lib/audit/__tests__
git commit -m "feat: each account gets a brand from its profile and plan: the owner keeps DevArtVentures, paid accounts their own, Free Auditely's"
```

---

### Task 3: The settings migration, the brand lookup and saving a profile

**Files:**
- Create:
  - `docs/migrations/2026-10-29-settings.sql`
  - `docs/settings-setup.md`
  - `app/_shared/lib/brand/brand.ts`
  - `app/api/settings/profile/route.ts`
- Modify:
  - `docs/migrations/2026-10-28-accounts.sql`: the stray-policy guard also allows `own_profile_update`.
  - `docs/supabase-schema.sql`: the new columns and table.
  - `app/__tests__/serviceDbUsage.test.ts`: add `app/_shared/lib/brand/brand.ts` and `app/_shared/lib/secrets/userSecrets.ts` to `ALLOWED`, and name both in the header comment.
  - `app/api/__tests__/requiresAccount.test.ts`: add `settings/profile`. Tasks 6 and 7 add `settings/mailbox` and `settings/hubspot` with their routes.
  - `app/_shared/lib/config/routes.ts`: `API_ROUTES.SETTINGS_PROFILE = '/api/settings/profile'`, `SETTINGS_MAILBOX = '/api/settings/mailbox'`, `SETTINGS_HUBSPOT = '/api/settings/hubspot'`.
  - `.env.local.example`: a `SECRETS_KEY=` line in the accounts block, with the comment `# 32 random bytes, base64, that encrypt saved mailbox passwords and HubSpot tokens: openssl rand -base64 32`.
- Test: `app/_shared/lib/brand/__tests__/brand.test.ts`, `app/api/settings/__tests__/profile.test.ts`

**Interfaces:**
- Consumes: `resolveBrand`, `Profile`, `logoFromDataUrl`, `BrandLogo` (Task 2); `parseProfileInput` (Task 2); `isOwnerEmail` and `planFor`; `brandLogo()` and `LOGO_CID` from `email/brandLogo.ts`.
- Produces:
  - `brand.ts` (server):
    - `class BrandUnavailable extends Error`
    - `brandFor(userId: string | null): Promise<Brand>`
    - `emailLogo(brand: Brand): Promise<{ content: Buffer; contentType: 'image/png' | 'image/jpeg'; filename: string } | null>`
    - `BRAND_UNAVAILABLE = "Couldn't load this account's branding. Try again in a minute."`
    - `SETTINGS_MIGRATION = 'docs/migrations/2026-10-29-settings.sql'`
    - `settingsUnavailable(isOwner: boolean): string`
  - `PUT /api/settings/profile` takes `ProfileFields` as JSON and answers `{ profile: ProfileFields }`.

**The migration** (one transaction, safe to run twice, in the style of `2026-10-28-usage.sql`):
1. **The profile columns.** `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS` for `display_name`, `company`, `website`, `logo_data_url`, `contact_email`, `contact_phone` and `booking_url` (all `TEXT`), plus `updated_at TIMESTAMPTZ`.
2. **A length check.** Drop and re-add a `profiles_settings_length` CHECK:
   - every text field at most 200 characters;
   - `logo_data_url` at most 350,000 characters.
3. **Column-level grants.** `GRANT UPDATE (display_name, company, website, logo_data_url, contact_email, contact_phone, booking_url, updated_at) ON profiles TO authenticated`. `email` and `id` stay unwritable.
4. **The update policy.** `DROP POLICY IF EXISTS own_profile_update ON profiles; CREATE POLICY own_profile_update ON profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()))`.
5. **The secrets table.** `user_secrets (user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('smtp','hubspot')), ciphertext TEXT NOT NULL, label TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, kind))`.
   - Turn RLS on with no policies.
   - `REVOKE ALL ON user_secrets FROM anon, authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON user_secrets TO service_role`.
6. **The guard.** It raises `Policies on user_secrets would let a signed-in user read saved passwords: …` when any policy exists on `user_secrets`.
7. **Accounts guard.** The guard in `2026-10-28-accounts.sql` allows `'own_rows','own_profile','own_profile_update'`.

**`brandFor` rules:**
- A null `userId` (a row from before accounts) gets the Auditely brand.
- It reads `serviceDb.from('profiles').select('*').eq('id', userId).maybeSingle()`. `select('*')` keeps it working before the migration: missing columns read as null.
- A read error throws `BrandUnavailable`, so an owner's report is never quietly drawn as Auditely's.
- No row gives the Auditely brand.
- Otherwise it returns `resolveBrand({ profile, isOwner: isOwnerEmail(profile.email), plan: planFor({ email, isOwner }).id })`. `resolveBrand` reads the logo with `logoFromDataUrl`.

**`emailLogo` rules:** the profile's logo, decoded, as `brand-logo.png` or `brand-logo.jpg`. Without one, the owner gets today's file through `brandLogo()`, as `brand-logo.png`. Anyone else gets null.

**`PUT /api/settings/profile`:**
1. `getSession()`, else `unauthorized()`.
2. `parseProfileInput`. Errors answer 400 `{ error, field }`.
3. `session.db.from('profiles').update({ ...profile, updated_at: now }).eq('id', account.id).select('id')`. It runs as the user, so the column grant and the policy are both locks.
4. Error codes `PGRST204` or `42703` (columns not there yet) answer 503 `{ error: settingsUnavailable(isOwner) }`:
   - the owner reads `Settings need the latest database update: run docs/migrations/2026-10-29-settings.sql in Supabase.`;
   - anyone else reads `Settings can't be saved right now. Try again later.`
5. Any other error answers 500 `Your profile wasn't saved. Try again.` Zero rows answers 404 `Profile not found`.
6. Success answers `{ profile }`. Every account may save a profile: Free accounts keep theirs for when they upgrade.

**`docs/settings-setup.md`**, in the voice of `docs/plans-setup.md`:
1. Run `2026-10-29-settings.sql` in the SQL Editor. It can go before the deploy: today's code ignores the new columns and table. Explain the two guard messages.
2. Add `SECRETS_KEY` (`openssl rand -base64 32`) to Vercel for Production and Preview. Warn that changing it later makes every saved mailbox and HubSpot token unreadable, so each account must connect again.
3. Deploy, then fill in the owner's profile in Settings (optional: blank keeps today's DevArtVentures details).
4. What testers on `PLAN_OVERRIDES` paid plans can now do.

- [ ] **Step 1: Write the failing tests**

```ts
// brand.test.ts (mock @/app/_shared/lib/supabase/client: serviceDb.from('profiles') answers `row` / `error`)
it('brands the owner from the profile, by email', async () => {
  vi.stubEnv('OWNER_EMAIL', 'owner@x.com');
  row = { id: 'u1', email: 'owner@x.com', company: null };
  expect((await brandFor('u1')).kind).toBe('owner');
});
it('reads a profile from before the migration, with none of the new columns', async () => {
  row = { id: 'u2', email: 'zed@x.com' };
  expect((await brandFor('u2')).kind).toBe('auditely');
});
it('refuses to guess when the profile can’t be read', async () => {
  error = { message: 'timeout' };
  await expect(brandFor('u1')).rejects.toBeInstanceOf(BrandUnavailable);
});
it('gives the owner today’s logo file in emails, and nobody else', async () => {
  expect(await emailLogo({ ...ownerBrand, logo: null })).toMatchObject({ filename: 'brand-logo.png', contentType: 'image/png' });
  expect(await emailLogo({ ...auditelyBrand })).toBeNull();
});
// profile.test.ts (the autocomplete route test's session pattern; fake db records the update)
it('saves the signed-in user’s own profile, as that user', async () => {
  const res = await PUT(put({ display_name: 'Sam', company: 'Acme' }));
  expect(res.status).toBe(200);
  expect(updates).toEqual([{ table: 'profiles', id: 'u2', values: expect.objectContaining({ display_name: 'Sam', company: 'Acme', updated_at: expect.any(String) }) }]);
});
it('names the field a bad value is in', async () => {
  const res = await PUT(put({ website: 'ftp://x' }));
  expect([res.status, (await res.json()).field]).toEqual([400, 'website']);
});
it('asks for the migration when the columns aren’t there yet, in words for whoever is signed in', async () => {
  updateError = { code: 'PGRST204', message: "Could not find the 'company' column" };
  expect((await (await PUT(put({ company: 'Acme' }))).json()).error).toBe("Settings can't be saved right now. Try again later.");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/brand app/api/settings app/__tests__ app/api/__tests__`
Expected: FAIL. The modules don't exist, and `serviceDbUsage` flags nothing new yet.

- [ ] **Step 3: Write the migration, `brand.ts`, the route, the setup doc, and the routes and test-list changes.**

- [ ] **Step 4: Run the same command.** Expected: PASS.

- [ ] **Step 5: Check the migration on a scratch Postgres (nothing committed)**

Follow the Phase 2 recipe (`docs/superpowers/plans/2026-10-28-plans-and-limits.md`, Task 2, Step 5):
- a throwaway cluster;
- the `anon`, `authenticated` and `service_role` roles, with `service_role` created `BYPASSRLS` as Supabase's is;
- `auth.users` and `auth.uid()`.

The accounts migration alters tables a blank database doesn't have. So instead of running it, copy its `profiles` part:
- the `CREATE TABLE`;
- `ENABLE ROW LEVEL SECURITY`;
- the `own_profile` policy;
- the two `GRANT`s.

Then run `2026-10-29-settings.sql` twice. Expected: both runs succeed.

As `authenticated` with the sub of user A:
- `UPDATE profiles SET company='A' WHERE id=A` updates 1 row;
- `UPDATE profiles SET company='X' WHERE id=B` updates 0 rows;
- `UPDATE profiles SET email='x@y.z' WHERE id=A` fails with permission denied;
- `SELECT * FROM user_secrets` fails with permission denied.

As `service_role`, an insert, a select and a delete on `user_secrets` all succeed.

Add `CREATE POLICY peek ON user_secrets FOR SELECT USING (true)` and rerun. Expected: the guard raises and names `peek`.

Check by reading that the accounts guard's list now has `own_profile_update`.

Stop the cluster, delete its directory, and record the results in the report.

- [ ] **Step 6: Commit**

```bash
git add docs/migrations docs/supabase-schema.sql docs/settings-setup.md app/_shared/lib/brand app/api/settings app/_shared/lib/config/routes.ts app/__tests__/serviceDbUsage.test.ts app/api/__tests__/requiresAccount.test.ts .env.local.example
git commit -m "feat: each account can save its name, company, logo and contact details, kept to its own row"
```

---

### Task 4: The AI writes as the account, and "Write again"

**Files:**
- Modify:
  - `app/_shared/lib/audit/aiReport.ts`
  - `app/_shared/lib/audit/generateAiReport.ts`
  - `app/api/generate/route.ts`
  - `app/_shared/lib/usage/rateLimit.ts`
  - `app/_shared/lib/hooks/useBusinessAudit.ts`
  - `app/_shared/components/auditely/aiReportSection/aiReportSection.tsx`
  - `app/_shared/components/auditely/auditPanel/auditPanel.tsx`
- Test: `app/_shared/lib/audit/__tests__/aiReport.test.ts`, `app/api/generate/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `ReportWriter`, `Brand` (Task 2); `brandFor`, `BrandUnavailable`, `BRAND_UNAVAILABLE` (Task 3).
- Produces:
  - `ReportInput.sender` is replaced by `writer: ReportWriter`.
  - `generateAiReport(db: Db, auditId: string, options?: { rewrite?: boolean }): Promise<AiReportResult>`.
  - `POST /api/generate` takes `{ audit_id, rewrite?: true }`.
  - `rewriteAllowed(accountId: string, now?: number): boolean` allows 10 per hour.
  - `useBusinessAudit` adds `rewriteReport(auditId: string): Promise<void>`, `rewriting: boolean` and `rewriteError: string | null`.
  - `AiReportSection` adds the optional props `onRewrite?: () => void`, `rewriting?: boolean` and `rewriteError?: string | null`.

**Rules:**
- **The prompt.** The first line is `You write for ${writer.about}, about a local business's website. Respond in JSON only.`, and the prompt says `Sign off with: ${writer.signOff}`. `replyProblem` checks for `writer.signOff`. `allowedNumbers` also lets through the numbers in `writer.about` and `writer.signOff`, so "Studio 54" isn't "invented".
- **The brand.** `generateAiReport` selects `'*, businesses(name, website, user_id)'` and calls `brandFor(biz.user_id)`. `BrandUnavailable` answers 503 `BRAND_UNAVAILABLE`.
- **Rewriting.** With `rewrite: true` and a report already saved, it writes again and updates that row by id (`summary`, `improvements`, `cold_email`), keeping its `created_at`. With no saved report, `rewrite` changes nothing. Without `rewrite`, the cached report is returned as today.
- **The rewrite limit.** In the route, a non-owner's rewrite is checked with `rewriteAllowed(account.id)` before any work. A refusal answers 429 `You can write a summary again 10 times an hour. Try again later.`
- **The UI.** A `Write again` ghost button sits beside the "Summary" heading. It shows `Writing…` and is disabled while it works, and it appears only when `onRewrite` is passed. `auditPanel` passes it everywhere except the demo (`useDemo()`). An error shows under the summary in the panel's red text: the server's message, else `Couldn't write it again. Try again in a minute.`

- [ ] **Step 1: Write the failing tests**

```ts
// aiReport.test.ts: replace the `sender` fixtures with `writer`
const owner = { about: 'DevArtVentures, a web agency', signOff: 'Numan, DevArtVentures' };
it('opens and signs off exactly as today for the owner', () => {
  const prompt = buildReportPrompt(input({ writer: owner }));
  expect(prompt.startsWith("You write for DevArtVentures, a web agency, about a local business's website. Respond in JSON only.")).toBe(true);
  expect(prompt).toContain('Sign off with: Numan, DevArtVentures');
});
it('writes for a Free account without a word of DevArtVentures', () => {
  const prompt = buildReportPrompt(input({ writer: { about: 'a web consultant', signOff: '[Your name]' } }));
  expect(prompt.toLowerCase()).not.toContain('devart');
  expect(prompt).toContain('Sign off with: [Your name]');
});
it('checks the account’s own sign-off, and lets its numbers through', () => {
  const studio = { about: 'Studio 54', signOff: 'Sam, Studio 54' };
  expect(replyProblem(reply(`Subject: Hi\n\nYour site is slow. ${offer}\n\nSam, Studio 54`), input({ writer: studio }))).toBeNull();
  expect(replyProblem(reply(`Subject: Hi\n\nYour site is slow. ${offer}\n\nNuman, DevArtVentures`), input({ writer: studio }))).toBe("It didn't sign off as Sam, Studio 54.");
});
// generate route.test.ts: mock '@/app/_shared/lib/brand/brand' (brandFor resolves a fixture brand)
it('writes as the brand of the business’s account', async () => {
  await POST(post({ audit_id: 'a1' }));
  expect(brandFor).toHaveBeenCalledWith('u2');
  expect(groq.create.mock.calls[0][0].messages[0].content).toContain('Sign off with: Sam, Acme');
});
it('writes a saved report again, in place, when asked', async () => {
  savedReport = { id: 'r1', audit_id: 'a1', summary: 'old' };
  const res = await POST(post({ audit_id: 'a1', rewrite: true }));
  expect(res.status).toBe(200);
  expect(updated).toEqual({ id: 'r1', values: expect.objectContaining({ summary: expect.any(String), cold_email: expect.any(String) }) });
  expect(inserted).toBeNull();
});
it('stops an account after 10 rewrites in an hour, but never the owner', async () => {
  for (let i = 0; i < 10; i++) await POST(post({ audit_id: 'a1', rewrite: true }));
  expect((await POST(post({ audit_id: 'a1', rewrite: true }))).status).toBe(429);
  session.current = ownerSession;
  expect((await POST(post({ audit_id: 'a1', rewrite: true }))).status).toBe(200);
});
it('answers 503 when the branding can’t be read', async () => {
  brandFor.mockRejectedValueOnce(new BrandUnavailable());
  expect((await POST(post({ audit_id: 'a1' }))).status).toBe(503);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/aiReport.test.ts app/api/generate`
Expected: FAIL.

- [ ] **Step 3: Implement the writer, the rewrite path, the limit, the hook and the button.** The inbound request route calls `generateAiReport(serviceDb, id)` unchanged; the owner's brand comes through `brandFor`.

- [ ] **Step 4: Run `npx vitest run app/_shared/lib/audit app/api app/_shared/components` and `npx tsc --noEmit`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/audit app/api/generate app/_shared/lib/usage/rateLimit.ts app/_shared/lib/hooks/useBusinessAudit.ts app/_shared/components/auditely/aiReportSection app/_shared/components/auditely/auditPanel
git commit -m "feat: the AI writes each summary and email as the account's own name and company, and Write again redoes an old one"
```

---

### Task 5: The PDF and the outreach email carry the brand

**Files:**
- Modify:
  - `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx` and `pdfSections.tsx`
  - `app/_shared/lib/audit/reportData.ts`, `pdfRender.ts` and `auditPdf.ts`
  - `app/demo/report/[auditId]/route.ts`
  - `app/_shared/lib/email/outreachEmail.ts`
  - `app/api/send-email/route.ts`: brand and logo only. Sending stays owner-only until Task 6.
- Test:
  - `app/_shared/components/auditely/__tests__/pdfDocument.test.ts` and `upworkPdf.test.ts`
  - `app/_shared/lib/audit/__tests__/pdfRender.test.ts` and `auditPdf.test.ts`
  - `app/_shared/lib/email/__tests__/outreachEmail.test.ts`
  - `app/api/send-email/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `Brand`, `OWNER_BRAND`, `resolveBrand` (Task 2); `brandFor`, `emailLogo`, `BrandUnavailable` (Task 3); `shortUrl`, `AUDITELY_URL`.
- Produces:
  - **`PdfBrand`** in `pdfDocument.tsx`: `interface PdfBrand { name: string; website: string | null; logo: string | null; invite: boolean; call: string }`. `logo` is a data URL.
  - **`PdfDocumentProps`** gains `brand: PdfBrand`, and `brandLink?: boolean` becomes `links?: boolean` (default true). `contact` stays.
  - **`pdfBrand(brand: Brand): PdfBrand`** in `reportData.ts`. `invite` is `brand.kind === 'auditely'`.
  - **Signatures that now take a brand:**
    - `buildPdfProps(audit, business, report, brand: Brand)`;
    - `buildUpworkPdfProps(audit, business, report, brand: Brand)`, which sets `contact: null` and `links: false`;
    - `renderPdf(audit, business, report, brand: Brand)` and `renderUpworkPdf(audit, business, report, brand: Brand)`.
  - **`renderAuditPdf(db, auditId, variant)`** keeps its signature. It calls `brandFor(business.user_id)` and answers `{ ok: false, status: 503, error: BRAND_UNAVAILABLE }` on `BrandUnavailable`; the result type's status union gains 503.
  - **`OutreachEmail.contact`** is replaced by `brand: OutreachBrand`, where `type OutreachBrand = Pick<Brand, 'name' | 'website' | 'tagline' | 'stripe' | 'call'> & { contact: PdfContact }`.

**Copy and layout rules:**
- **PDF header:** `Prepared by {name} · {date}`. The name links to `website` when `links` is on and there is a website. The invite brand reads `Prepared with Auditely · {date}` instead. A `brand.logo` shows left of the title at 32pt high (`objectFit: 'contain'`, at most 120pt wide).
- **PDF next step:** `NextStepSection({ contact, call })` reads `We can walk you through every issue in this report on ${call}, with no obligation.` It shows when there's a contact and the brand isn't the invite.
- **PDF invite:** a new `InviteSection` in `pdfSections.tsx`, styled like the next-step box, shown when `invite && links`:
  - title `Audited with Auditely`;
  - text `Auditely finds local businesses and checks their websites for what's costing them customers. Try it free.`;
  - one button, `Try Auditely free`, linking to `AUDITELY_URL`.
- **PDF footer:** `Powered by ` followed by `shortUrl(website)` as a link when `links` and a website, else the name. The contact email follows as today.
- **Email:** the header name is `brand.name`, linked to `brand.website` when there is one. The four-colour stripe row shows only with `brand.stripe`. The call text reads `We can walk you through every issue in the report on ${brand.call}, with no obligation.` The footer has:
  - `brand.name` in bold;
  - the tagline line, only with a tagline;
  - `shortUrl(website)` as a link, only with a website;
  - the contact details.

  The plain-text footer's first line is `${name} · ${website}`, or just the name.
- **The logo in the email.** The send-email route uses `emailLogo(brand)`. The cid is `brand-logo`, the filename comes from `emailLogo`, and the preview gets a data URL of the same bytes and type.
- **`/demo` PDFs:** they use `resolveBrand({ profile: null, isOwner: true, plan: 'owner' })`. `contact` is `reportContact()` only when `DEMO_PDF_CONTACT === '1'`, else null. That is today's output (ruling 2).

- [ ] **Step 1: Write the failing tests**

```ts
// pdfDocument.test.ts (the file's read() helper; brands built with resolveBrand)
it('says DevArtVentures exactly as today for the owner with a blank profile', () => {
  const page = read(PdfDocument(buildPdfProps(audit, business, report, ownerBrand)));
  expect(page.text).toContain('Prepared by DevArtVentures');
  expect(page.text).toContain('Powered by devartventures.com');
  expect(page.text).toContain('on a free 30-minute call, with no obligation.');
  expect(page.links).toContain('https://devartventures.com');
});
it('puts a paid account’s name, logo and booking link on its report', () => {
  const page = read(PdfDocument(buildPdfProps(audit, business, report, acmeBrand /* logo + booking_url set */)));
  expect(page.text).toContain('Prepared by Acme Studio');
  expect(page.text).toContain('on a free call, with no obligation.');
  expect(page.links).toEqual(expect.arrayContaining([acmeBrand.logo!.dataUrl, 'https://cal.com/acme']));
  expect(page.text.toLowerCase()).not.toContain('devart');
});
it('gives a Free account’s report the Auditely invitation and no contact box', () => {
  const page = read(PdfDocument(buildPdfProps(audit, business, report, auditelyBrand)));
  expect(page.text).toContain('Prepared with Auditely');
  expect(page.text).toContain('Audited with Auditely');
  expect(page.text).not.toContain('Want help fixing these?');
  expect(page.links).toContain('https://auditely.vercel.app');
  expect(page.text.toLowerCase()).not.toContain('devart');
});
it('keeps the Upwork version free of links and contact for the owner', () => {
  const page = read(PdfDocument(buildUpworkPdfProps(audit, business, report, ownerBrand)));
  expect(page.text).toContain('Prepared by DevArtVentures');
  expect(page.links.filter((l) => !l.startsWith('data:'))).toEqual([]);
});
// outreachEmail.test.ts
it('keeps the owner’s email as today', () => {
  const html = outreachHtml({ ...email, brand: { ...ownerBrand, contact: ownerBrand.contact! } });
  for (const s of ['DevArtVentures', 'Web engineering for growing businesses', '#2fbf7d', 'free 30-minute call']) expect(html).toContain(s);
});
it('sends a paid account’s email in its own name, with no stripe or tagline of DevArtVentures', () => {
  const html = outreachHtml({ ...email, brand: { ...acmeBrand, contact: acmeBrand.contact! } });
  expect(html).toContain('Acme Studio');
  expect(html).toContain('on a free call, with no obligation.');
  expect(html.toLowerCase()).not.toContain('devart');
  expect(html).not.toContain('#2fbf7d');
});
// auditPdf.test.ts
it('draws the report in the brand of the business’s account', async () => { /* brandFor called with businesses.user_id */ });
it('answers 503 when the branding can’t be read', async () => { /* BrandUnavailable → { ok: false, status: 503 } */ });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/components/auditely/__tests__ app/_shared/lib/audit app/_shared/lib/email app/api/send-email`
Expected: FAIL.

- [ ] **Step 3: Thread the brand through.** Update the callers in this order:
  1. `pdfDocument.tsx` and `pdfSections.tsx`;
  2. `reportData.ts`;
  3. `pdfRender.ts`;
  4. `auditPdf.ts`;
  5. the demo route;
  6. `outreachEmail.ts`;
  7. the send-email route, where `brandFor(account.id)` replaces `reportContact()` and `emailLogo` replaces `brandLogo()`.

  Delete `outreachEmail.ts`'s `SITE`, `TAGLINE` and `SHAPES` and `pdfDocument.tsx`'s `BRAND_URL` in favour of `OWNER_BRAND`. Update any other test that builds these props.

- [ ] **Step 4: Run the same command, then the whole suite with `npx vitest run`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/components/auditely app/_shared/lib/audit app/_shared/lib/email app/demo app/api/send-email
git commit -m "feat: reports and outreach emails carry the account's own name, logo and booking link, and Free reports invite the reader to try Auditely"
```

---

### Task 6: Saved secrets and sending from your own mailbox

**Files:**
- Create:
  - `app/_shared/lib/secrets/secrets.ts`
  - `app/_shared/lib/secrets/userSecrets.ts`
  - `app/_shared/lib/email/mailboxPresets.ts`
  - `app/_shared/lib/email/mailbox.ts`
  - `app/_shared/lib/email/senders.ts`
  - `app/api/settings/mailbox/route.ts`
- Modify:
  - `app/_shared/lib/email/mailer.ts`
  - `app/api/send-email/route.ts`
  - `app/_shared/lib/usage/rateLimit.ts`
  - `app/api/__tests__/requiresAccount.test.ts` (add `settings/mailbox`)
- Test:
  - `app/_shared/lib/secrets/__tests__/secrets.test.ts`
  - `app/_shared/lib/secrets/__tests__/userSecrets.test.ts`
  - `app/_shared/lib/email/__tests__/mailbox.test.ts`
  - `app/_shared/lib/email/__tests__/mailer.test.ts`
  - `app/api/settings/__tests__/mailbox.test.ts`
  - `app/api/send-email/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `brandFor`, `settingsUnavailable` (Task 3); `planFor`, `planHas`, `featureMessage` (Task 1).
- Produces:
  - **`secrets.ts`** (server):
    - `class SecretsKeyMissing extends Error`, `class SecretUnreadable extends Error`;
    - `secretsKey(env?: NodeJS.ProcessEnv): Buffer | null`: base64 that decodes to exactly 32 bytes, else null;
    - `encryptSecret(plain: string, aad: string, key: Buffer): string`;
    - `decryptSecret(token: string, aad: string, key: Buffer): string`, which throws `SecretUnreadable`.

    The token is `v1.<iv>.<tag>.<ciphertext>`, each part base64url, with a 12-byte random IV.
  - **`userSecrets.ts`** (server, serviceDb):
    - `type SecretKind = 'smtp' | 'hubspot'`;
    - `class SettingsNotMigrated extends Error`;
    - `saveSecret(userId: string, kind: SecretKind, value: unknown, label: string | null): Promise<void>`, an upsert on `(user_id, kind)` that JSON-encodes the value;
    - `readSecret<T>(userId: string, kind: SecretKind): Promise<T | null>`;
    - `deleteSecret(userId: string, kind: SecretKind): Promise<void>`;
    - `savedConnections(userId: string): Promise<Partial<Record<SecretKind, string | null>>>`, which selects only `kind, label` and never the ciphertext.

    The AAD is always `${userId}:${kind}`. Without a key, `saveSecret` and `readSecret` throw `SecretsKeyMissing`. Codes `42P01`/`PGRST205` throw `SettingsNotMigrated`, except in `savedConnections`, which returns `{}`.
  - **`mailboxPresets.ts`** (client-safe):
    - `interface MailboxSettings { host: string; port: 465 | 587; user: string; pass: string; fromEmail: string }`;
    - `MAILBOX_PRESETS: { id: 'gmail' | 'outlook' | 'zoho' | 'other'; label: string; host: string; port: 465 | 587; help: string }[]`;
    - `parseMailbox(body: unknown): { ok: true; mailbox: MailboxSettings } | { ok: false; error: string }`.
  - **`mailbox.ts`** (server):
    - `isPrivateAddress(address: string): boolean`, true when the address is not public;
    - `resolveMailHost(host: string, lookup?: (host: string) => Promise<{ address: string; family: number }[]>): Promise<{ ok: true; address: string } | { ok: false; error: string }>`;
    - `mailTransport(settings: MailboxSettings, address: string): Transporter`;
    - `verifyMailbox(settings: MailboxSettings, lookup?): Promise<{ ok: true } | { ok: false; error: string }>`.
  - **`mailer.ts`:**
    - `interface UserMailbox { settings: MailboxSettings; fromName: string }`;
    - `sendEmail(email: OutgoingEmail, mailbox?: UserMailbox, lookup?): Promise<SendResult>`.
  - **`senders.ts`** (server):
    - `mailboxFor(account: Account): Promise<{ ok: true; mailbox: UserMailbox['settings'] | 'env' } | { ok: false; status: number; error: string }>`;
    - `hubspotTokenFor(account: Account)`, added in Task 7.
  - **Rate limits:** `connectAllowed(accountId, now?)` allows 10 an hour and `sendAllowed(accountId, now?)` allows 50 an hour, both in `rateLimit.ts`.
  - **The mailbox route:** `PUT /api/settings/mailbox` takes `MailboxSettings` and answers `{ mailbox: string }` (the From address). `DELETE` answers `{ mailbox: null }`.

**Mailbox presets (help text is copy):**

| id | label | host | port | help |
|---|---|---|---|---|
| gmail | Gmail or Google Workspace | smtp.gmail.com | 465 | Use an app password: Google Account › Security › App passwords. 2-Step Verification must be on. |
| outlook | Outlook or Microsoft 365 | smtp.office365.com | 587 | Use an app password if two-step verification is on. A Microsoft 365 admin may need to turn on SMTP sign-in for your mailbox. |
| zoho | Zoho Mail | smtp.zoho.com | 465 | A paid Zoho account uses smtppro.zoho.com. Use an app password if two-factor sign-in is on. |
| other | Another provider | (blank) | 465 | Your provider's help pages list its SMTP server and port. |

**`parseMailbox` rules:**

| Field | Rule | Error |
|---|---|---|
| host | Trimmed and lowercased, a hostname of at most 253 characters (`/^[a-z0-9.-]+$/` with a dot) | `Enter your mail provider's SMTP server, like smtp.gmail.com.` |
| port | 465 or 587 | `The port must be 465 or 587.` |
| user | At most 254 characters | `Enter the mailbox's email address.` |
| pass | At most 200 characters, not trimmed | `Enter the mailbox's app password.` |
| fromEmail | Defaults to `user` when that is an email. Must be an email | `The From address must be an email address.` |

**`resolveMailHost` rules:**
1. Refuse an IP literal (`net.isIP`), `localhost`, anything ending in `.localhost`, `.local` or `.internal`, and a name with no dot. Error: `Use your mail provider's SMTP server name, like smtp.gmail.com.`
2. Look up every address (`dns.promises.lookup(host, { all: true })`). ENOTFOUND answers `${host} wasn't found. Check the server name.`
3. Refuse when any address is private. The `net.BlockList` covers:
   - `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`;
   - `172.16.0.0/12`, `192.0.0.0/24`, `192.168.0.0/16`, `198.18.0.0/15`;
   - `224.0.0.0/4`, `240.0.0.0/4`;
   - `::/128`, `::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8`.

   An `::ffff:` mapped address is checked as its IPv4. Error: `${host} doesn't point to a public mail server.`
4. Return the first address.

**`mailTransport`** connects to the checked `address`, never the name, with `tls: { servername: settings.host }`. It keeps today's settings: secure on 465, `requireTLS`, and timeouts of 10s, 10s and 30s.

**`verifyMailbox`:**
- It runs `resolveMailHost`, then `transport.verify()`.
- EAUTH answers `The mailbox refused the login. Check the email address and app password.`
- A Zoho "access restricted" answer gets the Zoho server sentence: `${host} isn't the server for this mailbox. A free Zoho account uses smtp.zoho.com, a paid one smtppro.zoho.com.`
- Anything else answers `Couldn't reach ${host} on port ${port}. Check the server and port.`

**`sendEmail` with a mailbox:**
- The From is `{ name: fromName, address: settings.fromEmail }`.
- There is no `EMAIL_BCC` and no `EMAIL_REPLY_TO`.
- The host is resolved per send; a refused host answers 400 with the resolve error.
- EAUTH reads `Your mailbox refused the login (…). Check the email address and app password in Settings.`
- Without a mailbox, sending is exactly today's environment path, error copy included.

**`mailboxFor`:**
- A saved `smtp` secret is returned. An owner with none gets `'env'`.
- Anyone else with none gets 400 `Connect your mailbox in Settings to send from Auditely.`
- `SecretUnreadable` answers 400 `Your saved mailbox can't be read any more. Connect it again in Settings.`
- `SecretsKeyMissing` answers 503 `Saving connections isn't set up: add SECRETS_KEY in Vercel.`
- `SettingsNotMigrated` gives `'env'` for the owner, and 503 `settingsUnavailable(false)` for anyone else.

**The mailbox route, `PUT /api/settings/mailbox`:**
1. Session.
2. `planHas(planFor(account).id, 'mailbox')`, else 403 `{ error: featureMessage('mailbox') }`.
3. `connectAllowed`, else 429 `You've tried 10 times this hour. Try again later.`
4. `parseMailbox`, then `verifyMailbox`, both answering 400 on failure.
5. `saveSecret(id, 'smtp', mailbox, mailbox.fromEmail)`.
6. Answer `{ mailbox: fromEmail }`.

`DELETE` calls `deleteSecret`. The password never appears in a response or a log line.

**Send-email route (replaces `ownerOnly`):**
1. Session.
2. The plan gate: 403 `featureMessage('mailbox')`.
3. The body checks, as today.
4. `brand = brandFor(account.id)`. `BrandUnavailable` answers 503 `BRAND_UNAVAILABLE`. A brand without a contact (`auditely`) answers 400 `Add your name or company in Settings, so the email says who it's from.`
5. Preview stops here, as today.
6. A non-owner needs `sendAllowed`, else 429 `You've sent 50 emails this hour. Try again later.`
7. `mailboxFor(account)`. The env setup check (`emailSetupProblem`) runs only for `'env'`.
8. The Verifalia check, as today. It already runs once at send for every account.
9. `sendEmail(email, mailbox === 'env' ? undefined : { settings: mailbox, fromName: brand.contact.name ?? brand.name })`.

- [ ] **Step 1: Write the failing tests**

```ts
// secrets.test.ts
const key = randomBytes(32), other = randomBytes(32);
it('round-trips, with a fresh IV each time', () => {
  const a = encryptSecret('app-pass', 'u1:smtp', key);
  expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
  expect(encryptSecret('app-pass', 'u1:smtp', key)).not.toBe(a);
  expect(decryptSecret(a, 'u1:smtp', key)).toBe('app-pass');
});
it('fails closed for another account, another kind, another key or a changed byte', () => {
  const a = encryptSecret('app-pass', 'u1:smtp', key);
  for (const [token, aad, k] of [[a, 'u2:smtp', key], [a, 'u1:hubspot', key], [a, 'u1:smtp', other],
                                  [a.slice(0, -2) + (a.endsWith('A') ? 'B' : 'A') + a.slice(-1), 'u1:smtp', key], ['garbage', 'u1:smtp', key]] as const)
    expect(() => decryptSecret(token, aad, k)).toThrow(SecretUnreadable);
});
it('takes only a 32-byte base64 key', () => {
  expect(secretsKey({ SECRETS_KEY: key.toString('base64') } as NodeJS.ProcessEnv)?.length).toBe(32);
  expect(secretsKey({ SECRETS_KEY: 'short' } as NodeJS.ProcessEnv)).toBeNull();
  expect(secretsKey({} as NodeJS.ProcessEnv)).toBeNull();
});
// userSecrets.test.ts (mock serviceDb; stub SECRETS_KEY)
it('stores only ciphertext, and lists connections without it', async () => { /* the upserted row's ciphertext doesn't contain 'app-pass'; savedConnections selected 'kind, label' */ });
it('reads a row copied from another account as unreadable', async () => { /* row saved for u1 returned for u2 → SecretUnreadable */ });
it('reads a missing table as nothing saved', async () => { /* error.code 'PGRST205' → savedConnections → {} */ });
// mailbox.test.ts (an injected lookup; no real DNS)
it.each(['127.0.0.1', '10.0.0.5', 'localhost', 'mail.internal', 'printer.local', 'intranet'])('refuses %s before any lookup', async (host) => {
  const lookup = vi.fn();
  expect((await resolveMailHost(host, lookup)).ok).toBe(false);
  expect(lookup).not.toHaveBeenCalled();
});
it.each(['169.254.169.254', '192.168.1.10', '::1', '::ffff:10.0.0.1', 'fd00::1'])('refuses a name that points to %s', async (address) => {
  expect(await resolveMailHost('smtp.evil.com', async () => [{ address, family: address.includes(':') ? 6 : 4 }]))
    .toEqual({ ok: false, error: "smtp.evil.com doesn't point to a public mail server." });
});
it('returns the checked public address, which the transport then connects to', async () => {
  expect(await resolveMailHost('smtp.gmail.com', async () => [{ address: '142.250.1.108', family: 4 }])).toEqual({ ok: true, address: '142.250.1.108' });
  const t = mailTransport({ host: 'smtp.gmail.com', port: 465, user: 'a@x.com', pass: 'p', fromEmail: 'a@x.com' }, '142.250.1.108');
  expect(t.options).toMatchObject({ host: '142.250.1.108', port: 465, secure: true, tls: { servername: 'smtp.gmail.com' } });
});
it('reads the presets’ ports and rejects anything but 465 and 587', () => {
  expect(parseMailbox({ host: 'smtp.gmail.com', port: 25, user: 'a@x.com', pass: 'p' })).toEqual({ ok: false, error: 'The port must be 465 or 587.' });
  expect(parseMailbox({ host: 'SMTP.Gmail.com ', port: 465, user: 'a@x.com', pass: ' p ' }))
    .toEqual({ ok: true, mailbox: { host: 'smtp.gmail.com', port: 465, user: 'a@x.com', pass: ' p ', fromEmail: 'a@x.com' } });
});
// mailer.test.ts (the file's existing nodemailer mock)
it('sends a user’s email from their mailbox, in their name, without the owner’s BCC', async () => { /* EMAIL_BCC set; sendMail got from {name:'Sam', address:'sam@acme.studio'}, no bcc; createTransport got the resolved address */ });
// mailbox route test
it('connects a paid account’s mailbox after checking it, and never answers with the password', async () => {
  const res = await PUT(put({ host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass' }));
  expect(res.status).toBe(200);
  expect(JSON.stringify(await res.json())).not.toContain('app-pass');
  expect(saveSecret).toHaveBeenCalledWith('u2', 'smtp', expect.objectContaining({ pass: 'app-pass' }), 'sam@acme.studio');
});
it('keeps it from Free accounts', async () => { /* free tester → 403 featureMessage('mailbox'), verifyMailbox not called */ });
it('stops after 10 tries in an hour', async () => { /* 11th → 429 */ });
// send-email route.test.ts (replace the owner-only cases)
it('sends a paid account’s email through its own mailbox, in its brand', async () => { /* sendEmail called with { settings, fromName: 'Sam Lee' } */ });
it('asks a paid account without a mailbox to connect one', async () => { /* 400 'Connect your mailbox in Settings to send from Auditely.' */ });
it('asks a paid account without a name to add one', async () => { /* brand auditely → 400 'Add your name or company…' */ });
it('keeps sending from Free accounts', async () => { /* 403 featureMessage('mailbox') */ });
it('still sends the owner’s email through the Vercel mailbox when nothing is saved', async () => { /* sendEmail called with mailbox undefined */ });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/secrets app/_shared/lib/email app/api/settings app/api/send-email app/api/__tests__`
Expected: FAIL.

- [ ] **Step 3: Implement the secrets, the presets, `mailbox.ts`, `mailer.ts`, `senders.ts`, the route and the send-email changes.**

- [ ] **Step 4: Run the same command, then `npx vitest run`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/secrets app/_shared/lib/email app/_shared/lib/usage/rateLimit.ts app/api/settings app/api/send-email app/api/__tests__
git commit -m "feat: Pro and Agency accounts connect their own mailbox, kept encrypted, and send outreach from it"
```

---

### Task 7: HubSpot per account

**Files:**
- Create: `app/api/settings/hubspot/route.ts`
- Modify:
  - `app/_shared/lib/crm/hubspot.ts`
  - `app/_shared/lib/email/senders.ts`
  - `app/api/crm/route.ts`
  - `app/api/__tests__/requiresAccount.test.ts` (add `settings/hubspot`)
- Test: `app/_shared/lib/crm/__tests__/hubspot.test.ts`, `app/api/settings/__tests__/hubspot.test.ts`, `app/api/crm/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `saveSecret`, `readSecret`, `deleteSecret`, `SecretUnreadable`, `SecretsKeyMissing`, `SettingsNotMigrated` and `connectAllowed` (Task 6).
- Produces:
  - **`checkHubSpotToken(token: string): Promise<{ ok: true } | { ok: false; error: string }>`** in `hubspot.ts`. It sends `GET ${API}${OBJECTS}/companies?limit=1` through the file's own request helper. A 401 or 403 answers `HubSpot refused the token. Check it has read and write access to companies and contacts.` Anything else answers `describeHubSpotError(err).error`.
  - **`hubspotTokenFor(account: Account): Promise<{ ok: true; token: string } | { ok: false; status: number; error: string }>`** in `senders.ts`. It returns the saved `hubspot` secret's `token`. An owner with none gets `process.env.HUBSPOT_TOKEN`. Nothing at all answers 400 `Connect HubSpot in Settings to send leads.` Unreadable, missing-key and not-migrated cases answer as in `mailboxFor`, with `Your saved HubSpot token can't be read any more. Connect it again in Settings.`
  - **The HubSpot route.** `PUT /api/settings/hubspot` takes `{ token: string }` and answers `{ hubspot: true }`. `DELETE` answers `{ hubspot: false }`.

**Rules:**
- **PUT order:**
  1. session;
  2. the plan gate (403 `featureMessage('hubspot')`);
  3. `connectAllowed` (429, as in Task 6);
  4. a token that is blank, or longer than 200 characters once trimmed, answers 400 `Paste your HubSpot access token.`;
  5. `checkHubSpotToken`, answering 400 on failure;
  6. `saveSecret(id, 'hubspot', { token }, null)`.
- **The CRM route.** `ownerOnly` is replaced by the plan gate, 403 `featureMessage('hubspot')`. The token comes from `hubspotTokenFor`. The rest is unchanged: each account's businesses keep their own `hubspot_company_id`, and a saved id HubSpot no longer knows already falls back to creating the company.

- [ ] **Step 1: Write the failing tests**

```ts
it('checks a token against the companies list', async () => { /* fetch stub 200 → ok; 401 → refused copy */ });
it('connects a paid account’s token after HubSpot accepts it, and never answers with it', async () => {
  const res = await PUT(put({ token: ' pat-na1-secret ' }));
  expect([res.status, await res.json()]).toEqual([200, { hubspot: true }]);
  expect(saveSecret).toHaveBeenCalledWith('u2', 'hubspot', { token: 'pat-na1-secret' }, null);
});
it('keeps HubSpot from Free accounts', async () => { /* 403 featureMessage('hubspot'), checkHubSpotToken not called */ });
it('sends a paid account’s lead with its own token', async () => { /* sendLead called with 'pat-na1-secret' */ });
it('asks a paid account without a token to connect one', async () => { /* 400 'Connect HubSpot in Settings to send leads.' */ });
it('still uses HUBSPOT_TOKEN for the owner when nothing is saved', async () => { /* sendLead called with the env token */ });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/crm app/api/settings app/api/crm app/api/__tests__`
Expected: FAIL.

- [ ] **Step 3: Implement `checkHubSpotToken`, `hubspotTokenFor`, the route and the CRM route changes.**

- [ ] **Step 4: Run the same command.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/crm app/_shared/lib/email/senders.ts app/api/settings app/api/crm app/api/__tests__
git commit -m "feat: Pro and Agency accounts connect their own HubSpot, kept encrypted, and send leads to it"
```

---

### Task 8: The Settings page and what each account has connected

**Files:**
- Create:
  - `app/_shared/lib/settings/connections.ts`
  - `app/_shared/lib/hooks/useConnections.ts`
  - `app/_shared/components/providers/ConnectionsProvider.tsx`
  - `app/(app)/settings/page.tsx`
  - `app/_shared/components/auditely/settingsView/settingsView.tsx`, plus `profileForm.tsx`, `mailboxForm.tsx` and `hubspotForm.tsx` in the same folder
- Modify:
  - `app/(app)/layout.tsx`
  - `app/demo/page.tsx` (wraps the workspace in `DEMO_CONNECTIONS`)
  - `app/_shared/components/auditely/appHeader/appHeader.tsx`: `NAV` gains `{ href: ROUTES.SETTINGS, label: 'Settings', short: 'Settings' }`.
- Test: `app/_shared/lib/settings/__tests__/connections.test.ts`, `app/_shared/components/auditely/__tests__/settingsView.test.ts`

**Interfaces:**
- Consumes: `brandFor`, `BrandUnavailable` (Task 3); `OWNER_BRAND` (Task 2); `savedConnections` (Task 6); `emailSetupProblem`, `MAILBOX_PRESETS` (Task 6); `API_ROUTES.SETTINGS_*` (Task 3); `planFor`, `PLANS`.
- Produces (client-safe, `useConnections.ts`):

```ts
export interface Connections {
  plan: PlanId;
  /** Has its own name on its emails: the owner, or a paid account with a name or company */
  branded: boolean;
  /** For the drafts' sign-off (Task 9): the brand's name and the sign-off the AI was given */
  sender: { name: string; signOff: string };
  mailbox: { address: string; source: 'saved' | 'env' } | null;
  hubspot: { source: 'saved' | 'env' } | null;
}
export const ConnectionsContext: React.Context<Connections | null>;
export const useConnections: () => Connections | null;
export const DEMO_CONNECTIONS: Connections; // plan 'owner', branded, sender { name: 'DevArtVentures', signOff: 'The DevArtVentures team' }, mailbox and hubspot null
```

- `connectionsFor(account: Account): Promise<Connections>` (server):
  - `sender` and `branded` come from `brandFor(account.id)`. `BrandUnavailable` reads as unbranded for non-owners and as `OWNER_BRAND` for the owner.
  - `mailbox` is the saved label. Without one, an owner gets `FROM_EMAIL`'s address when `emailSetupProblem()` is null.
  - `hubspot` is saved. Without it, an owner gets `'env'` when `HUBSPOT_TOKEN` is set.
  - A missing `user_secrets` table reads as nothing saved.
- `ConnectionsProvider({ connections, children })` wraps the app layout's children inside `UsageProvider`. The layout calls `connectionsFor` beside `usageSummary`.

**The `/settings` page:**
- A server component.
- It reads `session.db.from('profiles').select('*').eq('id', account.id).maybeSingle()`. Only the `ProfileFields` keys go to the client.
- It renders `AppHeader` plus `SettingsView({ profile, connections, plan, email })`.
- Four sections, with anchors `#profile`, `#mailbox`, `#hubspot` and `#plan`.

| Section | Heading | Copy |
|---|---|---|
| profile | Profile and branding | Lead: `Your name and company sign the AI's emails. On a paid plan your logo, contact details and booking link go on your reports and emails too.` Free adds `On the Free plan, reports and emails carry Auditely's name instead.` with a `See plans` link. Fields: Your name, Company, Website, Logo (hint `PNG or JPEG, under 256 KB`), Contact email (hint `Shown on reports. Leave blank to use ${email}.`), Phone, Booking link (hint `Your Calendly or other booking page, for "Book your free call".`). Button `Save profile`. Toast `Profile saved`. Note under the button: `Summaries written from now on use these details. "Write again" on a summary redoes an older one.` |
| mailbox | Mailbox | Lead: `Send outreach from your own address. It goes through your mail provider, so it lands in your Sent folder.` Free: `featureMessage('mailbox')` and `See plans`. Connected: `Sending from ${address}` and a `Disconnect` button. Env: `Sending from ${address}, set up in Vercel. Connect a mailbox here to use it instead.` plus the form. Form: Provider (the presets; choosing one fills server and port and shows its help), SMTP server, Port (465 or 587), Email address, App password (`type="password"`, never prefilled), Send as (hint `The From address, if it isn't the email address`). Button `Connect mailbox`, reading `Checking…` while it works. Toast `Mailbox connected`. |
| hubspot | HubSpot | Lead: `Send leads, their audit and a private report link to your HubSpot.` Free: `featureMessage('hubspot')` and `See plans`. Connected: `Connected` and `Disconnect`. Env: `Connected through HUBSPOT_TOKEN in Vercel.` Form: Private app access token (password field), hint `In HubSpot, create a private app (Settings › Integrations › Private apps) with read and write access to companies and contacts.` Button `Connect HubSpot`. Toast `HubSpot connected`. |
| plan | Plan | `You're on the ${PLANS[plan].name} plan.` with `See plans`. The owner reads `Your account has no limits.` |

- **Logo upload.** The logo field reads the file in the browser with `FileReader.readAsDataURL`. Before upload it checks the type (`image/png` or `image/jpeg`) and that the size is at most 256 KB, using the server's copy for the error. A `Remove logo` button sets it to null.
- **Save errors.** A save error shows the server's message; a field error shows under its field. After a connect or disconnect, the page calls `router.refresh()` so the layout's connections update.

- [ ] **Step 1: Write the failing tests**

```ts
// connections.test.ts (mock brandFor, savedConnections, emailSetupProblem)
it('tells the browser what is connected, never a password or token', async () => {
  savedConnections.mockResolvedValue({ smtp: 'sam@acme.studio', hubspot: null });
  const c = await connectionsFor(tester);
  expect(c).toEqual({ plan: 'pro', branded: true, sender: { name: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' },
    mailbox: { address: 'sam@acme.studio', source: 'saved' }, hubspot: { source: 'saved' } });
});
it('shows the owner’s Vercel mailbox and HubSpot when nothing is saved', async () => { /* source 'env' for both */ });
it('reads a missing secrets table as nothing saved', async () => { /* savedConnections → {} ; mailbox null for a tester */ });
// settingsView.test.ts (renderToStaticMarkup)
it('shows a Free account the plan notes in place of the mailbox and HubSpot forms', () => {
  const html = view({ plan: 'free' });
  expect(html).toContain('Sending from your own mailbox comes with the Pro and Agency plans.');
  expect(html).not.toContain('App password');
  expect(html).toContain('Save profile');
});
it('shows a connected mailbox by its address, with Disconnect', () => {
  const html = view({ plan: 'pro', connections: { mailbox: { address: 'sam@acme.studio', source: 'saved' } } });
  expect(html).toContain('Sending from sam@acme.studio');
  expect(html).toContain('Disconnect');
});
it('links to Settings from the header', () => { /* AppHeader markup contains href="/settings" and the label Settings */ });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/settings app/_shared/components/auditely/__tests__/settingsView.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the connections, the provider, the page, the forms and the header link.** Use the UI kit (`Input`, `Button`, `Dropdown`, `FileUpload` or a plain file input, `toast`), the `/plans` page's layout and spacing, and sentence-case headings.

- [ ] **Step 4: Run the same command, then `npx vitest run`, `npx tsc --noEmit` and `npm run lint`.** Expected: PASS and clean.

- [ ] **Step 5: Check it in the browser** on the dev server (port 3005), signed in as the owner:
- `/settings` shows the four sections.
- Saving a phone number shows the toast, and the number appears in a newly downloaded PDF's next-step box. Clear it again afterwards.
- The Mailbox section shows the env address.
- No password value is in the page source.

- [ ] **Step 6: Commit**

```bash
git add app/_shared/lib/settings app/_shared/lib/hooks/useConnections.ts app/_shared/components/providers/ConnectionsProvider.tsx "app/(app)" app/demo/page.tsx app/_shared/components/auditely/settingsView app/_shared/components/auditely/appHeader app/_shared/components/auditely/__tests__/settingsView.test.ts
git commit -m "feat: a Settings page for your profile and branding, mailbox, HubSpot and plan"
```

---

### Task 9: Report actions follow the plan

**Files:**
- Create: `app/_shared/lib/email/composeLinks.ts`, `app/_shared/components/auditely/reportActions/outreachOptions.ts`
- Modify:
  - `app/_shared/components/auditely/reportActions/reportActions.tsx`
  - `app/_shared/lib/email/followUp.ts`
  - `app/_shared/components/auditely/aiReportSection/aiReportSection.tsx`
  - `app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx:92`
- Test:
  - `app/_shared/lib/email/__tests__/composeLinks.test.ts`
  - `app/_shared/components/auditely/__tests__/outreachOptions.test.ts`
  - `app/_shared/lib/email/__tests__/followUp.test.ts`
  - `app/_shared/components/auditely/__tests__/account.test.ts`
  - `app/_shared/components/auditely/__tests__/upworkPdf.test.ts`

**Interfaces:**
- Consumes: `Connections`, `useConnections` (Task 8); `useUsage().promptUpgrade` (Phase 2); `ROUTES.SETTINGS`.
- Produces:
  - **`composeLinks(to: string, draft: OutreachDraft): { gmail: string; outlook: string }`.** Each value is passed through `encodeURIComponent`:
    - gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    - outlook: `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`.
  - **`outreachOptions`:**

```ts
type OutreachAction = { kind: 'send' } | { kind: 'compose' } | { kind: 'upgrade' } | { kind: 'setup'; label: string; href: string };
interface OutreachOptions { mail: OutreachAction; hubspot: OutreachAction; upworkPdf: boolean; verifyOnOpen: boolean }
function outreachOptions(input: { demo: boolean; account: Account | null; connections: Connections | null; upworkPdf: boolean }): OutreachOptions;
```

  - **Sender types.** `leadDrafts(coldEmail, businessName, audit, request?, sender?: Sender)` and `followUpDraft` / `requestDraft` take a `sender: Sender`, where `type Sender = { name: string; signOff: string }`.

**`outreachOptions` rules:**

| Who | mail | hubspot | upworkPdf | verifyOnOpen |
|---|---|---|---|---|
| demo | send | send | false | false |
| owner | send | send | `upworkPdf` | true |
| `planHas(connections.plan, 'mailbox')` | Unbranded: setup 'Add your name' to `/settings#profile`. No mailbox: setup 'Connect your mailbox' to `/settings#mailbox`. Otherwise: send | `connections.hubspot` ? send : setup 'Connect HubSpot' to `/settings#hubspot` | false | false |
| anyone else, or no connections | compose | upgrade | false | false |

**Rendering:**
- **send** is today's "Send email" / "Send follow-up" button. `openComposer` calls `mail.verify()` only when `verifyOnOpen` is set.
- **compose** is two outline buttons, `Open in Gmail` and `Open in Outlook`. Each opens `composeLinks(email, drafts.first)` with `window.open(url, '_blank', 'noopener,noreferrer')`, and each is disabled with today's title when there's no email address. The status line reads `Download the PDF and attach it before you send.` while nothing has been sent.
- **setup** is an outline button with its label that does `router.push(href)`.
- **upgrade** is the "Send to HubSpot" button calling `promptUpgrade({ feature: 'hubspot' })`.
- The Upwork button needs `upworkPdf` from the options.

**Sign-off rule (`followUp.ts`):** `signOff(firstEmail, sender)` keeps the first email's last paragraph when it is at most 80 characters and its letters and digits include the sender's name in the same form (`bare`, as in `aiReport.ts`). Otherwise it returns `sender.signOff`. `TEAM` is deleted.
- The default sender, when none is passed, is `{ name: 'Auditely', signOff: '[Your name]' }`.
- `AiReportSection` and `ReportActions` pass `useConnections()?.sender`.
- The demo gets DevArtVentures' sign-off through `DEMO_CONNECTIONS`.

**Modal note:** `Sent with your branding: your message, a snapshot of the audit and a "Book your free call" button, with the PDF report attached.`

- [ ] **Step 1: Write the failing tests**

```ts
// composeLinks.test.ts
it('opens a filled-in draft in Gmail and Outlook, every value encoded', () => {
  const { gmail, outlook } = composeLinks('office@smile.com', { subject: 'Your site & you', body: 'Hi,\n\nLine two' });
  expect(gmail).toBe('https://mail.google.com/mail/?view=cm&fs=1&to=office%40smile.com&su=Your%20site%20%26%20you&body=Hi%2C%0A%0ALine%20two');
  expect(outlook).toBe('https://outlook.office.com/mail/deeplink/compose?to=office%40smile.com&subject=Your%20site%20%26%20you&body=Hi%2C%0A%0ALine%20two');
});
// outreachOptions.test.ts: one case per table row, plus
it('sends a paid account to Settings for whatever is missing', () => {
  expect(outreachOptions({ demo: false, account: tester, connections: { ...pro, branded: false }, upworkPdf: true }).mail)
    .toEqual({ kind: 'setup', label: 'Add your name', href: '/settings#profile' });
  expect(outreachOptions({ demo: false, account: tester, connections: { ...pro, mailbox: null }, upworkPdf: true }).mail)
    .toEqual({ kind: 'setup', label: 'Connect your mailbox', href: '/settings#mailbox' });
});
it('never offers the Upwork PDF to anyone but the owner', () => {
  expect(outreachOptions({ demo: false, account: tester, connections: pro, upworkPdf: true }).upworkPdf).toBe(false);
});
// followUp.test.ts (replace the DevArtVentures-only cases)
const acme = { name: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' };
it('signs the follow-up like the first email, written over two lines or one', () => {
  expect(followUpDraft({ ...base, firstEmail: 'Hi,\n\nSlow site.\n\nSam Lee\nAcme Studio', sender: acme }).body.endsWith('Sam Lee\nAcme Studio')).toBe(true);
});
it('signs with the sender’s sign-off when the first email has another', () => {
  expect(followUpDraft({ ...base, firstEmail: 'Hi,\n\nSlow site.\n\nNuman, DevArtVentures', sender: acme }).body.endsWith('Sam Lee, Acme Studio')).toBe(true);
});
it('never signs a Free account’s drafts as DevArtVentures', () => {
  const { first, followUp } = leadDrafts('Subject: Hi\n\nSlow site.\n\n[Your name]', 'Smile', audit);
  expect(`${first.body}${followUp.body}`.toLowerCase()).not.toContain('devart');
  expect(followUp.body.endsWith('[Your name]')).toBe(true);
});
// account.test.ts: 'offers neither to anyone else, but still the PDF' becomes
it('offers a Free account Gmail and Outlook drafts and the HubSpot upgrade, and the PDF', () => {
  const html = card(tester);
  expect(html).toContain('Open in Gmail');
  expect(html).toContain('Open in Outlook');
  expect(html).not.toContain('Send email');
  expect(html).toContain('Send to HubSpot');
  expect(html).toContain('Download the PDF and attach it before you send.');
  expect(html).toContain('Download PDF report');
});
it('offers a connected paid account sending and HubSpot', () => { /* wrapped in ConnectionsContext pro with mailbox + hubspot → 'Send email', 'Send to HubSpot', no 'Open in Gmail' */ });
// upworkPdf.test.ts
it('is not offered to a paid account, even on the Audit a website tab', () => { /* tester with pro connections → no 'Upwork PDF' */ });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/email app/_shared/components/auditely/__tests__`
Expected: FAIL.

- [ ] **Step 3: Implement `composeLinks`, `outreachOptions`, the sender-aware drafts, the report actions and the modal note.**

- [ ] **Step 4: Run `npx vitest run`, `npx tsc --noEmit` and `npm run lint`.** Expected: all pass and clean.

- [ ] **Step 5: Check it in the browser** on the dev server:
- As the owner, a card's actions are unchanged: Send email, Send to HubSpot, and the Upwork PDF on Audit a website.
- With the owner's email temporarily added to `PLAN_OVERRIDES` as an allowlisted second account, if one is available, the Free and paid buttons show. Otherwise rely on the markup tests.

- [ ] **Step 6: Commit**

```bash
git add app/_shared/lib/email app/_shared/components/auditely
git commit -m "feat: Free accounts open their outreach in Gmail or Outlook, paid accounts send from their own mailbox and HubSpot, and follow-ups sign as the account"
```

---

## After the last task

1. The whole-branch review, with the Review Focus above.
2. With the owner's go-ahead:
   - run `2026-10-29-settings.sql` on the Auditely Supabase project through the Management API;
   - add `SECRETS_KEY` to Vercel for Production and Preview;
   - then merge and deploy, in the order `docs/settings-setup.md` gives.
3. Afterwards, the owner revokes the Supabase access token in `.env.local`.
