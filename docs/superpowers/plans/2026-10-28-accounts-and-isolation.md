# Accounts and Isolation (Launch Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared admin password with Supabase Auth accounts (email link and Google), and make every user's data private to them, with sign-ups closed.

**Architecture:** Sessions come from `@supabase/ssr` cookies, refreshed in `proxy.ts`. API routes get a per-request Supabase client signed in as the user, so Row Level Security (`user_id = auth.uid()`) decides what each query can see. The service-role client stays for the shared PageSpeed cache, the devartventures.com inbound route and signed report links. Lib functions that touch the database take the client as their first argument. The owner (`OWNER_EMAIL`) keeps all existing data and is the only account with the Requests tab, sending, HubSpot, email verification and paid email lookups.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.2.3, `@supabase/supabase-js` ^2.105.4, `@supabase/ssr` 0.12.7, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-27-public-launch-design.md` (Phase 1, "Data model", "Until launch" and "The owner").

## Global Constraints

- Add `@supabase/ssr@0.12.7` (exact version). No other new dependency.
- Node.js runtime only; no `export const runtime = 'edge'`.
- Env names: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the anon or publishable key), `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, `ALLOWED_EMAILS` (comma-separated), `SIGNUPS_OPEN` (only the exact string `true` opens sign-ups). `AUTH_SECRET` stays: it signs `/report/{token}` links. `ADMIN_PASSWORD` is no longer read.
- Email comparisons are case-insensitive and trimmed.
- Sign-ups are closed unless `SIGNUPS_OPEN=true`: only `OWNER_EMAIL` and `ALLOWED_EMAILS` can sign in.
- Owner-only in this phase: the Requests tab and `/api/audit-requests`, `/api/send-email`, `/api/crm`, `/api/verify-email`, and paid email lookups (`apiLookup: 'auto'` and `apiFallback`) in `/api/find-emails`.
- A user-scoped route never imports the service client. `user_id` on inserts made by a user comes from the column default `auth.uid()`; inserts made with the service client set `user_id` explicitly.
- Every new file starts with the `// path/to/file.ts` comment and a one-paragraph purpose comment, like the existing files.
- UI copy: sentence case, plain verbs, errors say what happened and what to do next, no apologies.
- Existing URLs (`/`, `/audit`, `/requests/{id}`, `/search/{id}`, `/searches`, `/demo`, `/report/{token}`) keep working.

## Review Focus

1. A user who runs a search named "audit requests" in "devartventures.com" (the reserved Requests search name) must never receive devartventures.com's requests: the inbound route only uses the owner's searches. Test in Task 4.
2. A `next` or `callbackUrl` of `//evil.com` or `https://evil.com` after sign-in must land on `/`, not off-site. Test in Task 5.
3. A sign-in link opened in a different browser or on a phone (no PKCE cookie) must still sign in: the `token_hash` path. Test in Task 5.
4. `OWNER_EMAIL=Owner@Example.com` and a session for `owner@example.com` are the same owner. Test in Task 1.
5. A non-owner who opens `/requests/{id}` directly sees Find leads, with no Requests tab and no requests request made. Test in Task 6.

---

## File map

| File | Responsibility |
|---|---|
| `app/_shared/lib/auth/account.ts` (new) | `Account` type and the sign-in rules from env: owner, allowlist, sign-ups open |
| `app/_shared/lib/supabase/client.ts` | The service-role client, renamed `serviceDb`, and the `Db` type |
| `app/_shared/lib/supabase/server.ts` (new) | Per-request user client, `getSession()`, `ownerUserId()`, 401/403 responses |
| `app/_shared/lib/supabase/proxySession.ts` (new) | Session refresh and the signed-in email for `proxy.ts` |
| `app/api/auth/route.ts` | Send a sign-in link (POST), sign out (DELETE) |
| `app/auth/google/route.ts` (new) | Start Google sign-in |
| `app/auth/callback/route.ts` (new) | Finish sign-in from a link or Google, enforce the rules |
| `app/(app)/layout.tsx` (new) | Gives the workspace pages the signed-in account |
| `app/_shared/lib/hooks/useAccount.ts`, `app/_shared/components/providers/AccountProvider.tsx` (new) | The account in client components |
| `docs/migrations/2026-10-28-accounts.sql` (new), `docs/supabase-schema.sql` | `profiles`, `user_id`, RLS |
| `docs/accounts-setup.md` (new) | The owner's Supabase, Google and Vercel steps, in order |

Deleted: `app/_shared/lib/auth/session.ts` (the password session; `signing.ts` stays for report links).

---

### Task 1: Sign-in rules

**Files:**
- Create: `app/_shared/lib/auth/account.ts`
- Test: `app/_shared/lib/auth/__tests__/account.test.ts`
- Modify: `.env.example` (add `SUPABASE_ANON_KEY`, `OWNER_EMAIL`, `ALLOWED_EMAILS`, `SIGNUPS_OPEN=false` with one comment line each; mark `ADMIN_PASSWORD` as no longer used)
- Modify: `docs/superpowers/specs/2026-10-27-public-launch-design.md` (the "The owner" row: `OWNER_EMAIL` names the owner; `ALLOWED_EMAILS` and `SIGNUPS_OPEN` in "Until launch")

**Interfaces:**
- Produces:
  - `interface Account { id: string; email: string; isOwner: boolean }`
  - `parseEmails(list: string | undefined): string[]`
  - `isOwnerEmail(email: string, env?: NodeJS.ProcessEnv): boolean`
  - `canSignIn(email: string, env?: NodeJS.ProcessEnv): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
const env = (over: Record<string, string> = {}) => ({ OWNER_EMAIL: 'Owner@Example.com', ALLOWED_EMAILS: ' tester@x.com, ,Other@Y.com ', ...over }) as NodeJS.ProcessEnv;

it('parses a comma list, trimmed and lowercased', () =>
  expect(parseEmails(' A@x.com, ,b@Y.com ')).toEqual(['a@x.com', 'b@y.com']));
it('knows the owner whatever the case', () => {
  expect(isOwnerEmail('owner@example.com', env())).toBe(true);
  expect(isOwnerEmail(' OWNER@EXAMPLE.COM ', env())).toBe(true);
  expect(isOwnerEmail('tester@x.com', env())).toBe(false);
  expect(isOwnerEmail('owner@example.com', env({ OWNER_EMAIL: '' }))).toBe(false);
});
it('lets only the owner and the allowlist in while sign-ups are closed', () => {
  expect(canSignIn('owner@example.com', env())).toBe(true);
  expect(canSignIn('other@y.com', env())).toBe(true);
  expect(canSignIn('stranger@z.com', env())).toBe(false);
  expect(canSignIn('stranger@z.com', env({ SIGNUPS_OPEN: 'yes' }))).toBe(false);
  expect(canSignIn('stranger@z.com', env({ SIGNUPS_OPEN: 'true' }))).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run app/_shared/lib/auth` — expected: FAIL, module not found.
- [ ] **Step 3: Implement `account.ts`** with the signatures above; `env` defaults to `process.env`.
- [ ] **Step 4: Run** the same command — expected: PASS.
- [ ] **Step 5: Commit** `feat: who can sign in: the owner, an allowlist, or anyone once sign-ups open`

---

### Task 2: Database clients for a signed-in user

**Files:**
- Modify: `package.json` (`npm install @supabase/ssr@0.12.7 --save-exact`)
- Modify: `app/_shared/lib/supabase/client.ts` (export `serviceDb` instead of `supabase`; `export type Db = SupabaseClient`)
- Create: `app/_shared/lib/supabase/server.ts`
- Create: `app/_shared/lib/supabase/proxySession.ts`
- Test: `app/_shared/lib/supabase/__tests__/server.test.ts`

The rename leaves the build broken until Task 3 updates the importers, so Tasks 2 and 3 land in one commit.

**Interfaces:**
- Consumes: `Account`, `isOwnerEmail`, `canSignIn` (Task 1)
- Produces:
  - `serviceDb: Db` and `type Db` from `client.ts`
  - `userDb(): Promise<Db>`: `createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll, setAll } })` over `await cookies()`. `setAll` swallows the error thrown in a Server Component.
  - `interface Session { db: Db; account: Account }`
  - `getSession(): Promise<Session | null>`: `db.auth.getClaims()`, then `sub` → `id` and `email` → `email`. It returns null with no claims, no email, or when `!canSignIn(email)`.
  - `ownerUserId(): Promise<string | null>`: `serviceDb.from('profiles').select('id').eq('email', <OWNER_EMAIL lowercased>).maybeSingle()`
  - `unauthorized(): NextResponse`: 401 `{ error: 'Sign in to continue' }`
  - `ownerOnly(): NextResponse`: 403 `{ error: "This isn't available on your account yet." }`
  - `readProxySession(request: NextRequest): Promise<{ response: NextResponse; email: string | null }>`: `createServerClient`, with request cookies in and `response` cookies out (the `@supabase/ssr` middleware pattern), then `getClaims()`.
  - `withSessionCookies(target: NextResponse, from: NextResponse): NextResponse`: copies `from`'s cookies onto a redirect or JSON response

- [ ] **Step 1: Write the failing tests.** Mock `@supabase/ssr` `createServerClient` to return `{ auth: { getClaims } }`, mock `next/headers` `cookies`, and mock `client.ts`.

```ts
it('maps the claims to an account, owner by email', async () => {
  claims = { sub: 'u1', email: 'Owner@Example.com' };
  expect((await getSession())?.account).toEqual({ id: 'u1', email: 'owner@example.com', isOwner: true });
});
it('has no session without claims, or for an email that may not sign in', async () => {
  claims = null; expect(await getSession()).toBeNull();
  claims = { sub: 'u2', email: 'stranger@z.com' }; expect(await getSession()).toBeNull();
});
it('finds the owner account by OWNER_EMAIL', async () => {
  profiles = { id: 'owner-1' };
  expect(await ownerUserId()).toBe('owner-1');
  expect(profileFilter).toEqual(['email', 'owner@example.com']);
});
```

- [ ] **Step 2: Run** `npx vitest run app/_shared/lib/supabase` — expected: FAIL.
- [ ] **Step 3: Implement `server.ts` and `proxySession.ts`** with the interfaces above.
- [ ] **Step 4: Run** the same command — expected: PASS. Continue with Task 3 before committing.

---

### Task 3: Lib functions take the database client

**Files:**
- Modify: `app/_shared/lib/audit/auditBusiness.ts`: `auditBusiness(db: Db, businessId: string, force = false)`
- Modify: `app/_shared/lib/audit/generateAiReport.ts`: `generateAiReport(db: Db, auditId: string)`
- Modify: `app/_shared/lib/audit/auditPdf.ts`: `renderAuditPdf(db: Db, auditId: string, variant: PdfVariant = 'full')`
- Modify: `app/_shared/lib/email/leadEmailCheck.ts`: `checkLeadEmail(db: Db, lead)`
- Modify: `app/_shared/lib/requests/requestSearch.ts`: `requestSearchIds(db: Db, ownerId: string)` and `ensureRequestSearchId(db: Db, ownerId: string)`. Both filter `.eq('user_id', ownerId)`; the insert adds `user_id: ownerId`.
- Modify: `app/_shared/lib/notifications/notify.ts`: `notify(db: Db, userId: string, ...notifications: NewNotification[])`. Each row gets `user_id: userId`.
- Modify: `app/_shared/lib/notifications/requestReminders.ts`: `syncRequestReminders(db: Db, userId: string, now: Date, timeZone?: string)`
- Modify: `app/_shared/lib/audit/pageSpeedStore.ts`: import `serviceDb` (the cache is shared; unchanged otherwise)
- Modify: every caller listed by `grep -rn "auditBusiness(\|generateAiReport(\|renderAuditPdf(\|checkLeadEmail(\|requestSearchIds(\|ensureRequestSearchId(\|syncRequestReminders(\|notify(" app`. For now each passes `serviceDb`; the owner id is `await ownerUserId()`, and the route answers 503 when it's null. Task 4 swaps the clients.
- Tests: `auditPdf.test.ts`, `leadEmailCheck.test.ts` and `pageSpeedStore.test.ts` pass their fake as the `db` argument, or mock `serviceDb`. Every route test that mocks `@/app/_shared/lib/supabase/client` exports `serviceDb` instead of `supabase`.

**Interfaces:**
- Consumes: `Db`, `serviceDb`, `ownerUserId` (Task 2)
- Produces: the signatures above. `app/_shared/lib/utils/bulkAudit.ts` has a different, browser-side `auditBusiness(business, deps)` that calls the API; it doesn't touch the database, so leave it alone.

- [ ] **Step 1: Add the failing test** to `app/_shared/lib/requests/__tests__/requestSearch.test.ts` (new):

```ts
it("only uses the owner's requests search, never another user's with the same name", async () => {
  await requestSearchIds(fakeDb, 'owner-1');
  expect(selectFilters).toContainEqual(['eq', 'user_id', 'owner-1']);
});
it('creates the requests search for the owner', async () => {
  selectResult = [];
  await ensureRequestSearchId(fakeDb, 'owner-1');
  expect(insertPayload).toEqual({ niche: 'audit requests', location: 'devartventures.com', user_id: 'owner-1' });
});
```

- [ ] **Step 2: Run** `npx vitest run app/_shared/lib/requests` — expected: FAIL.
- [ ] **Step 3: Change the signatures and callers** as listed.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p .` — expected: all pass, no type errors.
- [ ] **Step 5: Commit** (Tasks 2 and 3) `refactor: database work takes the client it runs as, ready for per-user sessions`

---

### Task 4: API routes run as the signed-in user

**Files:**
- Modify (user-scoped: `getSession()` → `unauthorized()` when null → use `session.db`): `app/api/search/route.ts`, `searches`, `results`, `audit`, `audit-url`, `generate`, `pdf`, `find-emails`, `notifications`
- Modify (owner-only: as above, then `if (!session.account.isOwner) return ownerOnly()`): `app/api/audit-requests/route.ts`, `send-email`, `crm`, `verify-email`
- Modify: `app/api/find-emails/route.ts`. For a non-owner, `apiLookup: 'auto'` returns `toResult(b)` without a lookup, and `apiFallback` is treated as false.
- Modify: `app/api/notifications/route.ts`. GET calls `syncRequestReminders(db, account.id, …)` only when `account.isOwner`. POST calls `notify(db, account.id, bulkDone(…))`.
- Modify: `app/api/audit-requests/route.ts`: uses `requestSearchIds(session.db, session.account.id)`
- Modify: `app/api/inbound/audit-request/route.ts`. Uses `serviceDb` and `const ownerId = await ownerUserId()`; with none it answers 503 `{ error: 'Audit requests are not set up' }` and logs `OWNER_EMAIL has no Auditely account yet`. The business insert adds `user_id: ownerId`, and every `notify` gets `ownerId`.
- Modify: `app/report/[token]/route.ts`: `renderAuditPdf(serviceDb, auditId)` (the signed token is the key)
- Create: `app/api/__tests__/requiresAccount.test.ts`
- Create: `app/__tests__/serviceDbUsage.test.ts`
- Modify: each route test mocks the session:

```ts
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
// beforeEach: session.current = { db: { from: db.from }, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
```

**Interfaces:**
- Consumes: `getSession`, `unauthorized`, `ownerOnly`, `ownerUserId` (Task 2); Task 3's signatures.

- [ ] **Step 1: Write the failing tests**
  - `requiresAccount.test.ts`: with `getSession` resolving null, every exported handler of the 13 routes above answers 401. Call each handler with a `NextRequest` and a JSON body of `{}`.
  - In the owner-only routes' tests: with `account.isOwner: false`, the handler answers 403 and makes no `db.from` call.
  - `find-emails` (new test file): a non-owner's `apiLookup: 'auto'` never calls `lookupEmailViaApis` (mock `utils/emailApis`).
  - `notifications` test: a non-owner's GET never queries `businesses`.
  - `inbound` test: the inserted business has `user_id: 'owner-1'`, each upserted notification has `user_id: 'owner-1'`, and with `ownerUserId` null the answer is 503 with no insert.
  - `serviceDbUsage.test.ts`: walks `app/` with `readdirSync(…, { recursive: true })`, skipping `__tests__`. It expects the non-test files that import `@/app/_shared/lib/supabase/client` to be exactly `app/_shared/lib/supabase/server.ts`, `app/_shared/lib/audit/pageSpeedStore.ts`, `app/api/inbound/audit-request/route.ts` and `app/report/[token]/route.ts`.
- [ ] **Step 2: Run** `npx vitest run app/api app/__tests__` — expected: the new tests fail.
- [ ] **Step 3: Change the routes** as listed.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p .` — expected: all pass.
- [ ] **Step 5: Commit** `feat: every API route runs as the signed-in user; requests, sending, HubSpot and paid lookups stay the owner's`

---

### Task 5: Sign in with an email link or Google

**Files:**
- Modify: `app/_shared/lib/config/routes.ts`: `ROUTES.AUTH_CALLBACK = '/auth/callback'` and `ROUTES.AUTH_GOOGLE = '/auth/google'`, both added to `PUBLIC_ROUTES`
- Modify: `app/api/auth/route.ts` (rewrite)
- Create: `app/auth/google/route.ts`, `app/auth/callback/route.ts`
- Modify: `proxy.ts`: `const { response, email } = await readProxySession(request)` and `isLoggedIn = !!email && canSignIn(email)`. Every redirect and 401 is returned through `withSessionCookies(…, response)`, and the pass-through returns `response`. The rest of the logic is unchanged.
- Delete: `app/_shared/lib/auth/session.ts`
- Modify: `app/_shared/components/forms/loginForm/loginForm.tsx` (rewrite in place) and `app/(pages)/(auth)/login/page.tsx`. The page passes `searchParams.error`; its lead line becomes "Use the email you were invited with."
- Tests: `app/api/auth/__tests__/route.test.ts` (new), `app/auth/callback/__tests__/route.test.ts` (new), `app/_shared/lib/config/__tests__/proxy.test.ts` (mock `readProxySession` instead of signing a token)

**Interfaces:**
- Consumes: `canSignIn`, `isOwnerEmail` (Task 1); `userDb`, `readProxySession`, `withSessionCookies` (Task 2); `safeCallbackUrl` (routes.ts)
- Produces:
  - `POST /api/auth` takes `{ email, callbackUrl? }`. It answers:
    - 400 `{ error: 'Enter your email address' }` for a missing or invalid address;
    - 403 `{ error: 'Auditely is invite-only for now. Use the email you were invited with.' }` when `!canSignIn`, without calling Supabase;
    - 200 `{ sent: true }` after `db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeCallbackUrl(callbackUrl))}` } })`;
    - 502 `{ error: "Couldn't send the link. Try again in a minute." }` when Supabase errors.
  - `DELETE /api/auth`: `db.auth.signOut()`, then 200 `{ success: true }`
  - `GET /auth/google?next=` calls `signInWithOAuth({ provider: 'google', options: { redirectTo: <callback with next> } })` and redirects to `data.url`. On error it redirects to `/login?error=google`.
  - `GET /auth/callback` takes `?code=` (Google, or a link opened in the same browser) → `exchangeCodeForSession(code)`, or `?token_hash=&type=email` (a link opened anywhere) → `verifyOtp({ token_hash, type: 'email' })`. Then:
    - `getClaims()`; when `!canSignIn(email)` → `signOut()` → `/login?error=closed`;
    - otherwise redirect to `safeCallbackUrl(next)`;
    - any failure → `/login?error=link`.
  - Login error copy, by `?error=`:
    - `link`: "That sign-in link has expired or was already used. Send yourself a new one."
    - `closed`: "Auditely is invite-only for now. Use the email you were invited with."
    - `google`: "Couldn't reach Google. Try again, or use your email."

- [ ] **Step 1: Write the failing tests.** Mock `userDb()` to return a fake `auth` object with `signInWithOtp`, `signInWithOAuth`, `exchangeCodeForSession`, `verifyOtp`, `getClaims` and `signOut`.
  - auth route: each answer above. The test reads `emailRedirectTo` back and checks that `callbackUrl: '//evil.com'` becomes `next=%2F`.
  - callback: `?code=c1` calls `exchangeCodeForSession('c1')` and redirects to `/search/abc` for `next=/search/abc`. `?token_hash=h1&type=email` calls `verifyOtp({ token_hash: 'h1', type: 'email' })`. `next=https://evil.com` lands on `/`. A stranger's email calls `signOut` and lands on `/login?error=closed`. An exchange error lands on `/login?error=link`.
  - proxy: keep today's cases; "signed in" now means `readProxySession` returns an allowed email. A disallowed email is treated as logged out. Add a test that `/auth/callback` passes while logged out, and that `/requests/<id>` logged out goes to `/login?callbackUrl=%2Frequests%2F<id>`.
- [ ] **Step 2: Run** `npx vitest run app/api/auth app/auth app/_shared/lib/config` — expected: FAIL.
- [ ] **Step 3: Implement** the routes, the proxy change and the login form. The form has an email field with an "Email me a link" button, then "Check your inbox: we sent a sign-in link to {email}." on success, plus a "Continue with Google" link to `/auth/google?next=…`. It keeps the existing form's styling.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p . && npx eslint app proxy.ts` — expected: all clean.
- [ ] **Step 5: Commit** `feat: sign in with an emailed link or Google instead of the shared password`

---

### Task 6: The account in the app

**Files:**
- Move (`git mv`, URLs unchanged): `app/page.tsx`, `app/audit/`, `app/requests/`, `app/search/`, `app/searches/` → under `app/(app)/`
- Create: `app/(app)/layout.tsx` (server component: `const session = await getSession()`, then `<AccountProvider account={session?.account ?? null}>{children}</AccountProvider>`)
- Create: `app/_shared/lib/hooks/useAccount.ts` (`AccountContext = createContext<Account | null>(null)`, `useAccount()`), `app/_shared/components/providers/AccountProvider.tsx`
- Modify: `modeTabs.tsx`. With `demo` or `!account?.isOwner` it shows the tabs without Requests (rename `DEMO_TABS` to `TABS_WITHOUT_REQUESTS`).
- Modify: `workspace.tsx`. When the view is requests and `!account?.isOwner`, use `TAB_HOME.leads`; the Requests panel is never mounted.
- Modify: `reportActions.tsx`. "Send email"/"Send follow-up" and "Send to HubSpot" render only when `demo || account?.isOwner`.
- Modify: `logoutButton.tsx`: `title={`Signed in as ${account.email}`}` when there's an account
- Tests: `app/_shared/components/auditely/__tests__/account.test.ts` (new), using `renderToStaticMarkup` with `AccountContext.Provider` as in `removeSites.test.ts`

**Interfaces:**
- Consumes: `Account` (Task 1), `getSession` (Task 2)
- Produces: `useAccount(): Account | null`, `AccountContext`, `AccountProvider({ account, children })`

- [ ] **Step 1: Write the failing tests**
  - `ModeTabs` for an owner renders "Requests"; for a non-owner it doesn't.
  - `Workspace` for a non-owner, rendered with `usePathname` mocked to `/requests/<id>`, has `aria-selected="true"` on Find leads and no `workspace-panel-requests` content.
  - `BusinessCard` with `initialAudit`, `initialReport` and `defaultOpen` (as in `removeSites.test.ts`) contains "Send email" and "Send to HubSpot" for the owner and neither for a non-owner.
- [ ] **Step 2: Run** `npx vitest run app/_shared/components` — expected: FAIL.
- [ ] **Step 3: Implement** as listed.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p . && npx eslint app proxy.ts && npx next build` — expected: all clean, and the route list still has `/`, `/audit`, `/requests`, `/requests/[id]`, `/search/[id]`, `/searches`.
- [ ] **Step 5: Commit** `feat: the app knows who's signed in: only the owner sees Requests, sending and HubSpot`

---

### Task 7: Migration and setup guide

**Files:**
- Create: `docs/migrations/2026-10-28-accounts.sql` (below)
- Modify: `docs/supabase-schema.sql`: the same tables, columns, defaults and policies for new installs, without the owner backfill
- Create: `docs/accounts-setup.md` (below)

- [ ] **Step 1: Write the migration.** It is safe to re-run. The owner replaces one address on the first line.

```sql
-- 2026-10-28 accounts migration. Supabase: Dashboard → SQL Editor. Safe to re-run.
-- 1. Replace the address: the account that keeps today's data (OWNER_EMAIL). Create it first (docs/accounts-setup.md).
DO $$ BEGIN PERFORM set_config('auditely.owner_email', lower('owner@example.com'), false); END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, lower(NEW.email)) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO profiles (id, email) SELECT id, lower(email) FROM auth.users WHERE email IS NOT NULL ON CONFLICT (id) DO NOTHING;

-- 2. Every user-owned row says whose it is; today's rows are the owner's
DO $$
DECLARE owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE lower(email) = current_setting('auditely.owner_email');
  IF owner_id IS NULL THEN RAISE EXCEPTION 'No account for %: create it in Authentication → Users first', current_setting('auditely.owner_email'); END IF;
  ALTER TABLE searches      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE businesses    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE searches      SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE businesses    SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE notifications SET user_id = owner_id WHERE user_id IS NULL;
END $$;
ALTER TABLE searches      ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE businesses    ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_searches_user      ON searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_user    ON businesses (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- 3. Each signed-in user reaches only their own rows. pagespeed_cache keeps no policy: server only.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_profile ON profiles;
CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON searches;
CREATE POLICY own_rows ON searches FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON businesses;
CREATE POLICY own_rows ON businesses FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON notifications;
CREATE POLICY own_rows ON notifications FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON audits;
CREATE POLICY own_rows ON audits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = audits.business_id AND b.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = audits.business_id AND b.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS own_rows ON ai_reports;
CREATE POLICY own_rows ON ai_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM audits a JOIN businesses b ON b.id = a.business_id
                 WHERE a.id = ai_reports.audit_id AND b.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM audits a JOIN businesses b ON b.id = a.business_id
                      WHERE a.id = ai_reports.audit_id AND b.user_id = (SELECT auth.uid())));
```

- [ ] **Step 2: Write `docs/accounts-setup.md`.** These are the owner's steps, in this order:
  1. In Supabase → Authentication → URL Configuration:
     - Site URL `https://auditely.vercel.app`;
     - Redirect URLs `https://auditely.vercel.app/**`, `http://localhost:3000/**` and `http://localhost:3005/**` (the `**` lets the callback carry `?next=`).
  2. Turn on the Google provider:
     - in Google Cloud → Credentials, create an OAuth client (Web), with authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`;
     - paste its client ID and secret into Supabase → Authentication → Providers → Google.
  3. Edit the email templates. In "Magic Link" and "Confirm signup", replace `{{ .ConfirmationURL }}` with `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, so a link works in any browser.
  4. Set up custom SMTP (Supabase's built-in sender only reaches the project team's addresses):
     - Authentication → SMTP Settings: `smtp.zoho.com`, port 465;
     - the `contact@devartventures.com` mailbox and app password, sender name "Auditely";
     - this is a stopgap until the Auditely domain exists.
  5. Create the owner account: Authentication → Users → Add user, with your `OWNER_EMAIL`, and tick "Auto confirm".
  6. Run `docs/migrations/2026-10-28-accounts.sql` with your address on its first line.
  7. In Vercel (Production and Preview), add `SUPABASE_ANON_KEY`, `OWNER_EMAIL`, `SIGNUPS_OPEN=false` and optionally `ALLOWED_EMAILS`. Leave `ADMIN_PASSWORD` until the deploy is confirmed, then remove it.
  8. Push straight after step 6. Between the migration and the deploy, the old code can't save new rows.
  9. Check it:
     - sign in by link and by Google;
     - your searches, URL audits and requests are all there;
     - an `ALLOWED_EMAILS` test account sees an empty workspace with no Requests tab;
     - that account runs a niche and city you've already searched and gets a new search of its own, not yours (Row Level Security scopes the "reuse a saved search" lookup, which no unit test can prove);
     - a stranger's email is refused.

- [ ] **Step 3: Check the SQL parses.** Run `npx --yes pgsql-parser` on the file if it's available. Otherwise review it by eye: the real check is Step 9 of the guide, on the owner's database.
- [ ] **Step 4: Commit** `docs: the accounts migration and the setup steps for Supabase, Google and Vercel`

---

## After the tasks

- Push only with the owner's go-ahead, and only straight after they've run the migration. The setup guide's order is the deploy order.
- Before the push, rerun the browser check from the notifications work (`scratchpad/shot/nav.mjs`) against a signed-in local session, to confirm addresses, the bell and the Requests tab still work for the owner.
