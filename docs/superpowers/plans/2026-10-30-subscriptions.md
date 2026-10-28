# Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An account buys Pro or Agency, monthly or yearly, through Stripe Checkout with US sales tax, manages or cancels it in Stripe's customer portal, and gets that plan's limits and features from a `subscriptions` table that only Stripe's signed webhook writes.

**Architecture:**
- **Reading the plan.** `getSession()` reads the account's own `subscriptions` row (RLS: its own row only) and puts the live one on `Account.subscription`. `planFor(account)` stays synchronous: owner, then a live subscription, then `PLAN_OVERRIDES`, then Free. `usagePeriod(account, now)` gives Free the calendar month and a paid plan the monthly window from its billing anchor. `brandFor` reads the same row with the service role.
- **Writing the plan.** Every webhook event and every return from Checkout re-reads the subscription from Stripe and saves Stripe's current state. Out-of-order or replayed events can't leave a stale plan behind. The service role is the only writer, through one store module.
- **Buying.** `POST /api/billing/checkout` opens a Stripe Checkout session for an account with no live subscription. `/plans/done` saves the result at once, without waiting for the webhook. `POST /api/billing/portal` opens the customer portal, where plans are switched and cancelled. Prices are found by lookup key. A setup script creates the products, prices, portal configuration and webhook endpoint.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.2.3, `@supabase/supabase-js` 2.118, `stripe` 23.0.1 (API version `2026-09-30.endive`, pinned by the SDK), vitest 5, Tailwind 4. Postgres 17 locally (`/usr/local/opt/postgresql@17/bin`) for the migration's scratch check.

**Spec:** `docs/superpowers/specs/2026-10-27-public-launch-design.md`. This plan is Phase 4, "Stripe". Phases 1–3 are merged to `main` and live.

## Scope

**In Phase 4:**
- the `subscriptions` table;
- Checkout for Pro and Agency, monthly and yearly, with Stripe Tax;
- the return from Checkout;
- the customer portal from `/plans` and Settings;
- the webhook;
- per-account usage windows;
- the plans page's buy buttons;
- Settings' plan and billing section;
- a Stripe setup script and setup doc.

**Not in Phase 4:**
- Opening sign-ups, the landing page's pricing section, and moving Stripe to the new domain. All of these are Phase 5.
- Free trials, refunds (done in the Stripe Dashboard), an admin list of subscribers, and deleting an account.
- Coupons beyond Stripe's own promotion codes (spec non-goal).

**Rulings this plan makes (flag them in review):**
1. **"Counted from the subscription's start date" means Stripe's billing cycle anchor.** That is the start date, or the day the billing interval last changed. A monthly plan's windows then line up exactly with what it's billed for. A yearly plan gets twelve monthly windows on the same day of the month.
2. **Checkout is only for an account with no live subscription.** Switching between Pro and Agency, between monthly and yearly, and cancelling all happen in Stripe's customer portal. Stripe prorates the switch.
3. **Prices are found by lookup key** (`auditely_pro_monthly`, `auditely_pro_yearly`, `auditely_agency_monthly`, `auditely_agency_yearly`), not by four price-ID variables. Test mode and live mode then differ only in `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. **`past_due` keeps the plan while Stripe retries the card.** Any subscription also stays live until 3 days after its period end, so a late renewal webhook doesn't drop a paying account.
5. **A live subscription wins over `PLAN_OVERRIDES`**, so a tester can test buying.
6. **Prices are tax-exclusive**: $24 plus sales tax where the owner is registered, as is usual in the US. Checkout collects the billing address that Stripe Tax needs.
7. **Promotion codes are on in Checkout.** They are Stripe's out-of-the-box coupons, which the spec allows.

## Global Constraints

**Plans and prices (spec, verbatim):**
- "**Free** $0 · **Pro** $24/mo · **Agency** $59/mo (yearly: two months free)". `plans.ts` already holds $240 and $590.
- Usage period: "Calendar month for Free. Paid plans: monthly windows counted from the subscription's start date, yearly plans included". The reason: "A yearly plan can't spend twelve months of searches in one".
- "Limits are hard … No overage billing at launch."
- Region: "Stripe Tax for US sales tax".
- Data model: "`subscriptions` (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start/end)". This plan adds `billing_interval`, `period_anchor` and `ends_at`.
- "Sign-ups stay closed through every phase." "Phases 1–4 run on auditely.vercel.app."

**Code rules (unchanged from Phase 3):**
- `serviceDb` stays in the files listed in `app/__tests__/serviceDbUsage.test.ts`. This plan adds exactly one: `app/_shared/lib/billing/subscriptionStore.ts`.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` never appear in a response, a page prop or a log line. Stripe customer and subscription IDs never go to the browser.
- Tests use fakes: never the real Supabase project, never the Stripe API. Webhook signatures are made locally with the SDK's `webhooks.generateTestHeaderString`.
- UI copy:
  - sentence case and plain verbs;
  - errors say what happened and what to do next, with no apologies;
  - no `→` in link text.
- Code follows the file around it:
  - the comment density;
  - the `// app/...` path header line;
  - `@/app/...` imports.

  Comment out pages and components; never delete them.
- Commit messages: `feat:` plus what the user now gets, in plain English, ending with the attribution trailer the dispatch gives.

## Review Focus

1. **A forged or replayed webhook.** A body with a bad or missing `stripe-signature` answers 400 and writes nothing. A replayed or out-of-order event leaves the row at Stripe's *current* state, because every event re-reads the subscription. Task 4 pins the signature cases. Task 3 pins the re-read.
2. **Someone else's Checkout session at `/plans/done?session_id=…`.** This covers a session whose `client_reference_id`, or whose subscription's `metadata.user_id`, names another account. Neither account changes. Task 3 (`syncCheckoutSession`) and Task 5 (the route) pin it.
3. **Re-subscribing after a cancel, then a late event for the old subscription.** The new live row stays, and the old `canceled` state never overwrites it. Task 3 (the store) pins it.
4. **Month ends and the time of day on a yearly plan.**
   - With an anchor of Jan 31 10:00 UTC, the windows run Jan 31 → Feb 28 → Mar 31.
   - A leap-day anchor gives Feb 28 the next year.
   - 09:00 on the anchor day still belongs to the window before.
   - A refusal's "They reset on …" date is that window's end.

   Task 1 (`monthlyWindow`) and Task 2 (`meterFor`) pin it.
5. **An account that already pays opens Checkout again** (an old tab, a second click). The server answers 409 with "Change it from Manage billing", and no second subscription is created. Task 5 pins it.

---

### Task 1: Billing rules

**Files:**
- Create: `app/_shared/lib/billing/billingRules.ts`
- Test: `app/_shared/lib/billing/__tests__/billingRules.test.ts`

**Interfaces:**
- Produces, client-safe (no server imports):
  - `type PaidPlanId = 'pro' | 'agency'`; `type BillingInterval = 'month' | 'year'`;
  - `PAID_PLANS: readonly PaidPlanId[] = ['pro', 'agency']`; `INTERVALS: readonly BillingInterval[] = ['month', 'year']`.
  - The `Subscription` interface, which the browser may see:

    ```ts
    export interface Subscription {
      plan: PaidPlanId;
      interval: BillingInterval;
      /** Stripe's status: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused */
      status: string;
      /** Stripe's billing cycle anchor (ISO): the monthly allowance windows count from it */
      anchor: string;
      /** The end of the period paid for (ISO) */
      periodEnd: string;
      /** When a cancelled subscription stops (ISO); null while it renews */
      endsAt: string | null;
    }
    ```
  - `GRACE_DAYS = 3`.
  - `isLive(sub: Pick<Subscription, 'status' | 'periodEnd'>, now: Date): boolean`. True when the status is `active`, `trialing` or `past_due` and `now < periodEnd + GRACE_DAYS`.
  - `monthlyWindow(anchor: Date, now: Date): { start: Date; end: Date }`. This is the window of whole months from `anchor` that contains `now`.
  - `lookupKey(plan: PaidPlanId, interval: BillingInterval): string`. It returns `auditely_${plan}_monthly` or `auditely_${plan}_yearly`.
  - `fromLookupKey(key: string | null | undefined): { plan: PaidPlanId; interval: BillingInterval } | null`.
  - `WEBHOOK_EVENTS`, the events the webhook handles:

    ```ts
    ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
     'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed'] as const
    ```

- [ ] **Step 1: Write the failing tests**

```ts
const iso = (d: { start: Date; end: Date }) => [d.start.toISOString(), d.end.toISOString()];
const at = (s: string) => new Date(s);

describe('monthlyWindow', () => {
  it('steps whole months from the anchor, keeping its day and time, clamped to short months', () => {
    const a = at('2026-01-31T10:00:00Z');
    expect(iso(monthlyWindow(a, at('2026-02-15T00:00:00Z')))).toEqual(['2026-01-31T10:00:00.000Z', '2026-02-28T10:00:00.000Z']);
    expect(iso(monthlyWindow(a, at('2026-03-01T00:00:00Z')))).toEqual(['2026-02-28T10:00:00.000Z', '2026-03-31T10:00:00.000Z']);
    expect(iso(monthlyWindow(a, at('2026-04-30T10:00:00Z')))).toEqual(['2026-04-30T10:00:00.000Z', '2026-05-31T10:00:00.000Z']);
  });
  it('gives a yearly plan the month it is in', () => {
    expect(iso(monthlyWindow(at('2026-03-14T09:30:00Z'), at('2026-10-27T12:00:00Z'))))
      .toEqual(['2026-10-14T09:30:00.000Z', '2026-11-14T09:30:00.000Z']);
  });
  it('takes the day from the anchor, not from the month before', () => {
    expect(iso(monthlyWindow(at('2024-02-29T00:00:00Z'), at('2025-03-10T00:00:00Z'))))
      .toEqual(['2025-02-28T00:00:00.000Z', '2025-03-29T00:00:00.000Z']);
  });
  it('counts back when now is before the anchor', () => {
    expect(iso(monthlyWindow(at('2026-11-14T09:30:00Z'), at('2026-11-01T00:00:00Z'))))
      .toEqual(['2026-10-14T09:30:00.000Z', '2026-11-14T09:30:00.000Z']);
  });
});

describe('isLive', () => {
  const now = at('2026-10-27T12:00:00Z');
  const sub = (status: string, periodEnd = '2026-11-14T00:00:00Z') => ({ status, periodEnd });
  it('keeps active, trialing and past_due subscriptions', () => {
    expect(['active', 'trialing', 'past_due'].map((s) => isLive(sub(s), now))).toEqual([true, true, true]);
  });
  it('drops ended ones', () => {
    expect(['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].map((s) => isLive(sub(s), now)))
      .toEqual([false, false, false, false, false]);
  });
  it('allows three days past the period end for a late renewal', () => {
    expect(isLive(sub('active', '2026-10-25T12:00:00Z'), now)).toBe(true);
    expect(isLive(sub('active', '2026-10-24T11:00:00Z'), now)).toBe(false);
  });
});

describe('lookup keys', () => {
  it('round-trips every plan and interval, and rejects others', () => {
    expect(lookupKey('agency', 'year')).toBe('auditely_agency_yearly');
    for (const plan of PAID_PLANS) for (const interval of INTERVALS)
      expect(fromLookupKey(lookupKey(plan, interval))).toEqual({ plan, interval });
    expect([fromLookupKey('auditely_owner_monthly'), fromLookupKey('other'), fromLookupKey(null)]).toEqual([null, null, null]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/billing`
Expected: FAIL. The module doesn't exist.

- [ ] **Step 3: Write `billingRules.ts`**

`addMonths(anchor, k)` takes the anchor's UTC year and month plus `k`. The day is `min(anchor's UTC day, days in that month)`, and the anchor's UTC time is kept. For `monthlyWindow`:
- start with `k = (nowYear − anchorYear) × 12 + (nowMonth − anchorMonth)`;
- subtract one if `addMonths(anchor, k) > now`;
- return `[addMonths(k), addMonths(k + 1))`.

- [ ] **Step 4: Run them and watch them pass.** Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/billing
git commit -m "feat: paid plans count their allowances in monthly windows from the day they were bought"
```

---

### Task 2: The subscriptions table and each account's plan

**Files:**
- Create: `docs/migrations/2026-10-30-subscriptions.sql`, `app/_shared/lib/billing/subscription.ts`
- Modify:
  - `docs/supabase-schema.sql`
  - `app/_shared/lib/auth/account.ts`
  - `app/_shared/lib/supabase/server.ts`
  - `app/_shared/lib/usage/plans.ts`
  - `app/_shared/lib/usage/usage.ts`
  - `app/_shared/lib/brand/brand.ts`
- Test:
  - `app/_shared/lib/billing/__tests__/subscription.test.ts`
  - `app/_shared/lib/usage/__tests__/plans.test.ts`
  - `app/_shared/lib/usage/__tests__/usage.test.ts`
  - `app/_shared/lib/supabase/__tests__/server.test.ts`
  - `app/_shared/lib/brand/__tests__/brand.test.ts`

**Interfaces:**
- Consumes: `Subscription`, `isLive`, `monthlyWindow` (Task 1).
- Produces:
  - `docs/migrations/2026-10-30-subscriptions.sql`. One transaction, safe to re-run, with a header in the style of `2026-10-28-usage.sql`.
    - **Guard:** the stray-policy guard for `subscriptions` (any policy other than `own_subscription` raises).
    - **The table:**

      ```sql
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL CHECK (plan IN ('pro', 'agency')),
        billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
        status TEXT NOT NULL,
        stripe_customer_id TEXT NOT NULL UNIQUE,
        stripe_subscription_id TEXT NOT NULL UNIQUE,
        current_period_start TIMESTAMPTZ NOT NULL,
        current_period_end TIMESTAMPTZ NOT NULL,
        period_anchor TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ```

    - **Access:**
      - RLS on;
      - `own_subscription FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))`;
      - `REVOKE ALL … FROM anon, authenticated`;
      - `GRANT SELECT … TO authenticated`;
      - `GRANT SELECT, INSERT, UPDATE, DELETE … TO service_role`.

    The same table also goes into `docs/supabase-schema.sql`.
  - In `subscription.ts` (server, no `serviceDb` import):
    - `SUBSCRIPTIONS_MIGRATION = 'docs/migrations/2026-10-30-subscriptions.sql'`.
    - `interface SubscriptionRow`: the table's columns minus `updated_at`. The timestamps are ISO strings and `ends_at` is `string | null`.
    - `toSubscription(row: SubscriptionRow): Subscription`.
    - `subscriptionOf(db: Db, userId: string, now = new Date()): Promise<Subscription | null>`. It returns the live subscription, or null. It **never throws**. A read error logs `[billing] Read no subscription for <userId>: run ${SUBSCRIPTIONS_MIGRATION} in Supabase (<message>)` and returns null. The table is the only new read, so an error here means the migration hasn't run.
    - `customerIdOf(db: Db, userId: string): Promise<string | null>`. It returns the account's Stripe customer whether or not the subscription is live, and **throws** on a read error.
  - `Account` gains `subscription?: Subscription | null`, with the comment "The live Stripe subscription; getSession fills it, and absent reads as none". `getSession()` sets it from `subscriptionOf(db, claims.sub)`.
  - `planFor(account: Pick<Account, 'email' | 'isOwner' | 'subscription'>, env = process.env): Plan` checks, in order: owner, `account.subscription` (that plan), the override, Free.
  - `calendarMonth(now: Date)` is today's `usagePeriod`, renamed. `usagePeriod(account: Pick<Account, 'isOwner' | 'subscription'>, now: Date): { start: Date; end: Date }` returns `monthlyWindow(new Date(subscription.anchor), now)` when there is a subscription, else `calendarMonth(now)`.
  - `meterFor` and `usageSummary` use `usagePeriod(account, …)` for the claim's `p_since`, the head counts' `gte` and `resetsAt`.
  - `brandFor(userId)` reads the profile and `subscriptionOf(serviceDb, userId)` together, and passes `subscription` to `planFor`.
  - The `plans.ts` header comment reads: "A live Stripe subscription sets an account's plan; PLAN_OVERRIDES (email:plan pairs) still gives testers one without paying. Free allowances reset on the first of each calendar month, UTC; a paid plan's every month from its billing anchor."

- [ ] **Step 1: Write the failing tests**

```ts
// subscription.test.ts — a fake Db whose from('subscriptions').select().eq().maybeSingle() answers a set row/error and records the eq filter
const row = { user_id: 'u2', plan: 'pro', billing_interval: 'year', status: 'active', stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1', current_period_start: '2026-03-14T09:30:00.000Z', current_period_end: '2027-03-14T09:30:00.000Z',
  period_anchor: '2026-03-14T09:30:00.000Z', ends_at: null };
it("reads the account's own live subscription", async () => {
  expect(await subscriptionOf(db({ data: row }), 'u2', new Date('2026-10-27T00:00:00Z'))).toEqual({
    plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null });
  expect(filter).toEqual(['user_id', 'u2']);
});
it('reads a cancelled one, or none, as no subscription', async () => {
  expect(await subscriptionOf(db({ data: { ...row, status: 'canceled' } }), 'u2')).toBeNull();
  expect(await subscriptionOf(db({ data: null }), 'u2')).toBeNull();
});
it('reads a table it cannot read as no subscription, and says which migration to run', async () => {
  expect(await subscriptionOf(db({ error: { message: 'relation "subscriptions" does not exist' } }), 'u2')).toBeNull();
  expect(String(vi.mocked(console.error).mock.calls[0])).toContain('2026-10-30-subscriptions.sql');
});
it('finds the Stripe customer of a cancelled subscription, and throws on a read error', async () => {
  expect(await customerIdOf(db({ data: { stripe_customer_id: 'cus_1' } }), 'u2')).toBe('cus_1');
  await expect(customerIdOf(db({ error: { message: 'down' } }), 'u2')).rejects.toThrow('down');
});

// plans.test.ts — rename the existing usagePeriod cases to calendarMonth, then:
const yearly = { plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null } as const;
it('takes the plan from a live subscription, before an override', () => {
  vi.stubEnv('PLAN_OVERRIDES', 'tester@x.com:agency');
  expect(planFor({ email: 'tester@x.com', isOwner: false, subscription: yearly }).id).toBe('pro');
  expect(planFor({ email: 'tester@x.com', isOwner: false, subscription: null }).id).toBe('agency');
  expect(planFor({ email: 'o@x.com', isOwner: true, subscription: yearly }).id).toBe('owner');
});
it('counts a paid plan from its anchor and Free by the calendar month', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  expect(usagePeriod({ isOwner: false, subscription: yearly }, now).start.toISOString()).toBe('2026-10-14T09:30:00.000Z');
  expect(usagePeriod({ isOwner: false, subscription: null }, now).start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
});

// usage.test.ts — the file's fakes; now() is 2026-10-14T09:00Z, half an hour before the anchor's day-of-month time
const subscriber = { ...tester, subscription: yearly };
it("claims a subscriber's use against the window that started on the anchor's day last month", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: null });
  const claim = await meterFor(subscriber, now).claim('search');
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_limit: 25, p_since: '2026-09-14T09:30:00.000Z' });
  expect(claim).toMatchObject({ ok: false, status: 402, limit: { plan: 'pro', resetsAt: '2026-10-14T09:30:00.000Z' } });
});
it("counts a subscriber's usage from the same window", async () => {
  const summary = await usageSummary(userDb({ search: 3 }), subscriber, now());
  expect(summary).toMatchObject({ plan: 'pro', resetsAt: '2026-10-14T09:30:00.000Z', usage: { search: { used: 3, limit: 25 } } });
  expect(filters).toContainEqual(['gte', 'created_at', '2026-09-14T09:30:00.000Z']);
});

// server.test.ts — the SSR fake gains from('subscriptions') answering fake.subscription / fake.subscriptionError
it("puts the account's live subscription on it, read as the user", async () => {
  fake.claims = { sub: 'u2', email: 'tester@x.com' }; vi.stubEnv('ALLOWED_EMAILS', 'tester@x.com');
  fake.subscription = { ...row };
  expect((await getSession())?.account.subscription).toMatchObject({ plan: 'pro', interval: 'year' });
});
it('signs in with no subscription when the table cannot be read', async () => {
  /* same claims, fake.subscriptionError = { message: 'missing' } */
  expect((await getSession())?.account.subscription).toBeNull();
});

// brand.test.ts — the serviceDb fake answers from('subscriptions') too
it('brands the reports of an account that pays through Stripe', async () => {
  /* profile with display_name 'Sam', company 'Acme'; no PLAN_OVERRIDES; subscriptions row: live pro */
  expect((await brandFor('u2')).kind).not.toBe('auditely');
});
it('brands as Free while the subscriptions table is missing', async () => {
  /* same profile; subscriptions read errors */
  expect((await brandFor('u2')).kind).toBe('auditely');
});
```

The server test's existing "maps the claims to an account" expectation gains `subscription: null`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/billing app/_shared/lib/usage app/_shared/lib/supabase app/_shared/lib/brand`
Expected: FAIL. `subscription.ts` doesn't exist, `calendarMonth` isn't exported, and the plan ignores subscriptions.

- [ ] **Step 3: Write the migration, `subscription.ts` and the changes to `account.ts`, `server.ts`, `plans.ts`, `usage.ts` and `brand.ts`.**

`getSession` reads the subscription only after `canSignIn` passes.

- [ ] **Step 4: Run them and watch them pass**, then run `npx tsc --noEmit` and `npx vitest run`.
Expected:
- everything passes;
- `tsc` reports no errors;
- every other caller of `planFor` still compiles, because `subscription` is optional on `Account`.

- [ ] **Step 5: Check the migration on a scratch Postgres (nothing committed)**

Set up a scratch database as in the Phase 2 recipe (`docs/superpowers/plans/2026-10-28-plans-and-limits.md`, Task 2, Step 5):
- a throwaway cluster;
- the `anon`, `authenticated` and `service_role` roles, with `service_role` created `BYPASSRLS`;
- `auth.users` and `auth.uid()`.

Run `2026-10-30-subscriptions.sql` twice. Expected: both runs succeed.

As `service_role`, insert rows for users A and B. Expected: the insert, an update and a delete all succeed.

As `authenticated` with A's sub:
- `SELECT` returns A's row only;
- `INSERT` fails with permission denied;
- `UPDATE … SET plan='agency'` fails with permission denied.

Add `CREATE POLICY peek ON subscriptions FOR SELECT USING (true)` and rerun. Expected: the guard raises and names `peek`.

Stop the cluster, delete its directory, and record the results in the report.

- [ ] **Step 6: Commit**

```bash
git add docs/migrations docs/supabase-schema.sql app/_shared/lib/billing app/_shared/lib/auth app/_shared/lib/supabase app/_shared/lib/usage app/_shared/lib/brand
git commit -m "feat: an account's paid subscription sets its plan, limits and branding"
```

---

### Task 3: Stripe, the subscription store and syncing from Stripe

**Files:**
- Create:
  - `app/_shared/lib/billing/stripe.ts`
  - `app/_shared/lib/billing/subscriptionStore.ts`
  - `app/_shared/lib/billing/sync.ts`
- Modify: `package.json`, `package-lock.json`, `app/__tests__/serviceDbUsage.test.ts`
- Test:
  - `app/_shared/lib/billing/__tests__/stripe.test.ts`
  - `app/_shared/lib/billing/__tests__/subscriptionStore.test.ts`
  - `app/_shared/lib/billing/__tests__/sync.test.ts`

**Interfaces:**
- Consumes:
  - `SubscriptionRow` (Task 2);
  - `fromLookupKey`, `lookupKey`, `isLive`, `PaidPlanId` and `BillingInterval` (Task 1).
- Produces:
  - Install with `npm install stripe@23.0.1 --save-exact`.
  - In `stripe.ts` (server):
    - `stripeClient(env = process.env): Stripe | null`. It returns null without `STRIPE_SECRET_KEY`, and one cached `new Stripe(key)` per key.
    - `billingReady(env = process.env): boolean`.
    - `BILLING_NOT_SET_UP = "Billing isn't set up yet. Try again later."`.
    - `priceIdFor(stripe: Stripe, plan: PaidPlanId, interval: BillingInterval): Promise<string | null>`. It calls `stripe.prices.list({ lookup_keys: [lookupKey(plan, interval)], active: true, limit: 1 })` and returns the first price's id, or null.
  - In `subscriptionStore.ts` (the one new `serviceDb` file):
    - `saveSubscription(row: SubscriptionRow): Promise<'saved' | 'kept'>`. It reads the account's current row first.
      - When that row holds a **different** subscription that is live (by status) and the incoming one isn't, it returns `'kept'` and writes nothing.
      - When both are live, it logs `[billing] <userId> has two live subscriptions: <old> and <new>` and saves.
      - Otherwise it upserts with `{ onConflict: 'user_id' }` and `updated_at: now`.

      It throws on a database error.
    - `userIdForCustomer(customerId: string): Promise<string | null>`. It throws on a database error.
  - In `sync.ts`:
    - `type StripeApi = Pick<Stripe, 'subscriptions' | 'checkout'>`.
    - `class UnknownPrice extends Error`.
    - `rowFromStripe(sub: Stripe.Subscription, userId: string): SubscriptionRow`. It maps from the first item `items.data[0]`:
      - the period start and end come from `item.current_period_start` and `item.current_period_end`. They are seconds, and become ISO strings.
      - `period_anchor` comes from `sub.billing_cycle_anchor`.
      - `ends_at` is `sub.cancel_at`, or else the item's period end when `sub.cancel_at_period_end` is set, or else null.
      - `stripe_customer_id` is taken from `sub.customer`, whether that is a string or an object.
      - Plan and interval come from `fromLookupKey(item.price.lookup_key)`. When that is null, it throws `UnknownPrice` naming the price id.
    - `syncSubscription(stripe: StripeApi, subscriptionId: string, userHint?: string | null): Promise<'saved' | 'kept' | 'unmatched' | 'refused'>`.
      - It re-reads the subscription with `stripe.subscriptions.retrieve`.
      - It finds the account from `metadata.user_id`, then `userHint`, then `userIdForCustomer`.
      - It returns `'refused'` when `metadata.user_id` and `userHint` are both present and differ.
      - It returns `'unmatched'`, with a log line, when no account is found.
      - Otherwise it returns `saveSubscription`'s result.
    - `syncCheckoutSession(stripe: StripeApi, sessionId: string, accountId: string)` returns the same union. It retrieves the session, and returns `'refused'` unless all of these hold:
      - `client_reference_id === accountId`;
      - `mode === 'subscription'`;
      - there is a subscription.

      Then it calls `syncSubscription(stripe, subId, accountId)`.
  - `ALLOWED` in `serviceDbUsage.test.ts` gains `'app/_shared/lib/billing/subscriptionStore.ts'`, and its header comment gains "the subscription store (only Stripe, never the user, writes a plan)".

- [ ] **Step 1: Write the failing tests**

```ts
// stripe.test.ts
it('is not ready without a secret key, and finds a price by its lookup key', async () => {
  expect([stripeClient({}), billingReady({})]).toEqual([null, false]);
  const list = vi.fn().mockResolvedValue({ data: [{ id: 'price_9' }] });
  expect(await priceIdFor({ prices: { list } } as unknown as Stripe, 'agency', 'year')).toBe('price_9');
  expect(list).toHaveBeenCalledWith({ lookup_keys: ['auditely_agency_yearly'], active: true, limit: 1 });
});

// subscriptionStore.test.ts — serviceDb fake: from('subscriptions') select→eq→maybeSingle answers `existing`; upsert records [payload, options]
const incoming = { ...row, stripe_subscription_id: 'sub_old', status: 'canceled' };
it('keeps a live subscription when a late event for an older, ended one arrives', async () => {
  existing = { stripe_subscription_id: 'sub_new', status: 'active' };
  expect(await saveSubscription(incoming)).toBe('kept');
  expect(upserts).toEqual([]);
});
it('records the cancellation of the subscription it holds', async () => {
  existing = { stripe_subscription_id: 'sub_old', status: 'active' };
  expect(await saveSubscription(incoming)).toBe('saved');
  expect(upserts[0][1]).toEqual({ onConflict: 'user_id' });
});
it('replaces an ended row with a new live subscription', async () => {
  existing = { stripe_subscription_id: 'sub_old', status: 'canceled' };
  expect(await saveSubscription({ ...row, stripe_subscription_id: 'sub_new' })).toBe('saved');
});
it('says so when an account ends up with two live subscriptions', async () => {
  existing = { stripe_subscription_id: 'sub_a', status: 'active' };
  await saveSubscription({ ...row, stripe_subscription_id: 'sub_b' });
  expect(String(vi.mocked(console.error).mock.calls[0])).toContain('two live subscriptions');
});

// sync.test.ts — vi.mock the store; a fake StripeApi with subscriptions.retrieve and checkout.sessions.retrieve as vi.fn()
const stripeSub = { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { user_id: 'u2' },
  billing_cycle_anchor: 1773480600 /* 2026-03-14T09:30Z */, cancel_at: null, cancel_at_period_end: true,
  items: { data: [{ current_period_start: 1773480600, current_period_end: 1805016600 /* 2027-03-14T09:30Z */,
    price: { id: 'price_a', lookup_key: 'auditely_agency_yearly' } }] } };
it("maps a yearly Agency subscription that won't renew", () => {
  expect(rowFromStripe(stripeSub as never, 'u2')).toEqual({ user_id: 'u2', plan: 'agency', billing_interval: 'year', status: 'active',
    stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', current_period_start: '2026-03-14T09:30:00.000Z',
    current_period_end: '2027-03-14T09:30:00.000Z', period_anchor: '2026-03-14T09:30:00.000Z', ends_at: '2027-03-14T09:30:00.000Z' });
});
it('refuses a price that is not one of the four plans', () => {
  const other = { ...stripeSub, items: { data: [{ ...stripeSub.items.data[0], price: { id: 'price_x', lookup_key: null } }] } };
  expect(() => rowFromStripe(other as never, 'u2')).toThrow(UnknownPrice);
});
it("re-reads the subscription from Stripe and saves it to the account in its metadata", async () => {
  retrieveSub.mockResolvedValue(stripeSub);
  expect(await syncSubscription(stripe, 'sub_1')).toBe('saved');
  expect(retrieveSub).toHaveBeenCalledWith('sub_1');
  expect(vi.mocked(saveSubscription).mock.calls[0][0]).toMatchObject({ user_id: 'u2', plan: 'agency' });
});
it("falls back to the customer's account, and saves nothing when there is none", async () => {
  retrieveSub.mockResolvedValue({ ...stripeSub, metadata: {} });
  vi.mocked(userIdForCustomer).mockResolvedValueOnce('u7').mockResolvedValueOnce(null);
  expect(await syncSubscription(stripe, 'sub_1')).toBe('saved');
  expect(await syncSubscription(stripe, 'sub_1')).toBe('unmatched');
  expect(saveSubscription).toHaveBeenCalledTimes(1);
});
it("refuses another account's Checkout session without reading its subscription", async () => {
  retrieveSession.mockResolvedValue({ client_reference_id: 'u9', mode: 'subscription', subscription: 'sub_1' });
  expect(await syncCheckoutSession(stripe, 'cs_test_1', 'u2')).toBe('refused');
  expect(retrieveSub).not.toHaveBeenCalled();
});
it('refuses a session whose subscription names another account', async () => {
  retrieveSession.mockResolvedValue({ client_reference_id: 'u2', mode: 'subscription', subscription: 'sub_1' });
  retrieveSub.mockResolvedValue({ ...stripeSub, metadata: { user_id: 'u9' } });
  expect(await syncCheckoutSession(stripe, 'cs_test_1', 'u2')).toBe('refused');
  expect(saveSubscription).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/lib/billing app/__tests__/serviceDbUsage.test.ts`
Expected: FAIL. The modules don't exist, and `serviceDbUsage` doesn't list the store yet.

- [ ] **Step 3: Install `stripe` and write `stripe.ts`, `subscriptionStore.ts` and `sync.ts`.**

Then add the store to `ALLOWED`. Check the field names against the installed SDK's `esm/resources/Subscriptions.d.ts` and `SubscriptionItems.d.ts`. The period dates are on the item, not the subscription.

- [ ] **Step 4: Run them and watch them pass**, then run `npx tsc --noEmit`. Expected: PASS, and no type errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/_shared/lib/billing app/__tests__/serviceDbUsage.test.ts
git commit -m "feat: Auditely keeps each account's plan in step with its Stripe subscription"
```

---

### Task 4: Stripe's webhook

**Files:**
- Create: `app/api/stripe/webhook/route.ts`
- Modify: `app/_shared/lib/config/routes.ts`, `proxy.ts` (header comment only)
- Test: `app/api/stripe/webhook/__tests__/route.test.ts`, `app/_shared/lib/config/__tests__/routes.test.ts`

**Interfaces:**
- Consumes:
  - `stripeClient` (Task 3);
  - `syncSubscription` (Task 3);
  - `WEBHOOK_EVENTS` (Task 1).
- Produces:
  - `INBOUND_ROUTES.STRIPE_WEBHOOK = '/api/stripe/webhook'`, added to `PUBLIC_ROUTES`. The comment says Stripe's signature is its key.
  - `POST(request: NextRequest)` reads the raw body with `await request.text()`, then:
    1. Without a Stripe client or `STRIPE_WEBHOOK_SECRET` it answers 503 `{ error: BILLING_NOT_SET_UP }` and logs which variable is missing (by name).
    2. It checks the event with `stripe.webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret)`. On failure it answers 400 `{ error: 'Invalid signature' }`.
    3. For `checkout.session.completed` with `mode === 'subscription'` and a subscription, it calls `syncSubscription(stripe, subscriptionId, session.client_reference_id)`.
    4. For the five `customer.subscription.*` events in `WEBHOOK_EVENTS`, it calls `syncSubscription(stripe, event.data.object.id)`.
    5. It ignores any other event.
    6. When a sync throws, it logs `[billing] Failed to sync <type> <event id>: <message>` and answers 500, so Stripe retries.
    7. Otherwise it answers 200 `{ received: true }`.
  - The `proxy.ts` header comment adds ", and Stripe's webhook (it checks Stripe's signature)".

- [ ] **Step 1: Write the failing tests**

```ts
// route.test.ts — vi.mock sync.ts (syncSubscription: vi.fn()); env STRIPE_SECRET_KEY 'sk_test_x', STRIPE_WEBHOOK_SECRET 'whsec_test'
const signer = new Stripe('sk_test_x');
function post(event: object, signature?: string) {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', ...event });
  const header = signature ?? signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
  return POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': header } }));
}
it('refuses a body that Stripe did not sign, and syncs nothing', async () => {
  expect((await post({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }, 't=1,v1=forged')).status).toBe(400);
  expect(syncSubscription).not.toHaveBeenCalled();
});
it('refuses a request with no signature header', async () => { /* NextRequest without the header */ expect(res.status).toBe(400); });
it('syncs the subscription an event names', async () => {
  const res = await post({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } });
  expect(res.status).toBe(200);
  expect(vi.mocked(syncSubscription).mock.calls[0].slice(1)).toEqual(['sub_1']);
});
it('passes a completed Checkout session’s account as the hint', async () => {
  await post({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u2' } } });
  expect(vi.mocked(syncSubscription).mock.calls[0].slice(1)).toEqual(['sub_1', 'u2']);
});
it('acknowledges other events without syncing', async () => {
  expect((await post({ type: 'invoice.paid', data: { object: { id: 'in_1' } } })).status).toBe(200);
  expect((await post({ type: 'checkout.session.completed', data: { object: { mode: 'payment', subscription: null } } })).status).toBe(200);
  expect(syncSubscription).not.toHaveBeenCalled();
});
it('answers 500 when the sync fails, so Stripe tries again', async () => {
  vi.mocked(syncSubscription).mockRejectedValueOnce(new Error('db down'));
  expect((await post({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } })).status).toBe(500);
});
it('answers 503 without a webhook secret', async () => { vi.stubEnv('STRIPE_WEBHOOK_SECRET', ''); /* … */ expect(res.status).toBe(503); });

// routes.test.ts
it("lets Stripe's webhook through without a session", () => expect(isPublicRoute('/api/stripe/webhook')).toBe(true));
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/api/stripe app/_shared/lib/config`
Expected: FAIL. The route doesn't exist, and the path isn't public.

- [ ] **Step 3: Write the route, and add the routes and the proxy comment.**

- [ ] **Step 4: Run them and watch them pass.** Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe app/_shared/lib/config proxy.ts
git commit -m "feat: Stripe's signed webhook records every new, changed and cancelled subscription"
```

---

### Task 5: Checkout, the return from it, and the customer portal

**Files:**
- Create:
  - `app/api/billing/checkout/route.ts`
  - `app/api/billing/portal/route.ts`
  - `app/(app)/plans/done/route.ts`
- Modify: `app/_shared/lib/config/routes.ts`, `app/api/__tests__/requiresAccount.test.ts`
- Test:
  - `app/api/billing/__tests__/checkout.test.ts`
  - `app/api/billing/__tests__/portal.test.ts`
  - `app/(app)/plans/done/__tests__/route.test.ts`

**Interfaces:**
- Consumes:
  - `stripeClient`, `priceIdFor` and `BILLING_NOT_SET_UP` (Task 3);
  - `syncCheckoutSession` (Task 3);
  - `customerIdOf` (Task 2);
  - `PAID_PLANS` and `INTERVALS` (Task 1).
- Produces:
  - New routes:
    - `API_ROUTES.BILLING_CHECKOUT = '/api/billing/checkout'`;
    - `API_ROUTES.BILLING_PORTAL = '/api/billing/portal'`;
    - `ROUTES.PLANS_DONE = '/plans/done'`.

    `requiresAccount.test.ts` lists `billing/checkout` and `billing/portal`.
  - `POST /api/billing/checkout` takes the body `{ plan: PaidPlanId, interval: BillingInterval }` and answers `{ url }`. It works through these steps in order:
    1. No session: 401.
    2. The owner: 400 "Your account has no limits, so there's no plan to buy."
    3. Any other plan or interval: 400 "Choose Pro or Agency, billed monthly or yearly."
    4. No Stripe client: 503 `BILLING_NOT_SET_UP`.
    5. `account.subscription` is set: 409 `` `You're already on the ${PLANS[plan].name} plan. Change it from Manage billing in Settings.` ``.
    6. No price for the lookup key: 503 `BILLING_NOT_SET_UP`, logging `[billing] No active price <key>: run scripts/stripeSetup.mjs`.
    7. `customerIdOf` throws, or Stripe throws: 502 "Couldn't open checkout. Try again in a minute.", logging the error message.

    The session it creates:

    ```ts
    {
      mode: 'subscription', line_items: [{ price, quantity: 1 }],
      client_reference_id: account.id, subscription_data: { metadata: { user_id: account.id } },
      ...(customer ? { customer, customer_update: { address: 'auto', name: 'auto' } } : { customer_email: account.email }),
      automatic_tax: { enabled: true }, billing_address_collection: 'required', allow_promotion_codes: true,
      success_url: `${origin}${ROUTES.PLANS_DONE}?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}${ROUTES.PLANS}`,
    }
    ```

    `origin` is `request.nextUrl.origin`.
  - `POST /api/billing/portal` takes the body `{ returnTo?: 'plans' | 'settings' }` and answers `{ url }`.
    - No session: 401. No Stripe client: 503.
    - No customer: 404 "There's no billing to manage yet. Choose a plan first."
    - Otherwise it calls `stripe.billingPortal.sessions.create`:
      - with `customer`;
      - with `return_url`: `${origin}${ROUTES.PLANS}` for `'plans'`, else `${origin}${ROUTES.SETTINGS}#plan`;
      - with `configuration` only when `STRIPE_PORTAL_CONFIGURATION` is set.
    - A failure gives 502 "Couldn't open billing. Try again in a minute."
  - `GET /plans/done?session_id=…`:
    - Without a session it redirects to `ROUTES.LOGIN`.
    - When `session_id` matches `/^cs_(test|live)_[A-Za-z0-9]+$/` and Stripe is set up, it runs `syncCheckoutSession(stripe, id, account.id)`. An error is logged, never thrown.
    - Then, always, it answers 303 to `${ROUTES.PLANS}?subscribed=1`.

- [ ] **Step 1: Write the failing tests**

```ts
// checkout.test.ts — vi.mock server.ts getSession; vi.mock stripe.ts with importOriginal, stripeClient: () => fake
// (fake.prices.list → { data: [{ id: 'price_pro_y' }] }, fake.checkout.sessions.create → { url: 'https://checkout.stripe.com/c/1' });
// vi.mock subscription.ts customerIdOf
const buy = (body: unknown) => POST(new NextRequest('http://localhost/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) }));
it('opens a taxed subscription Checkout for the account', async () => {
  const res = await buy({ plan: 'pro', interval: 'year' });
  expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/1' });
  expect(create.mock.calls[0][0]).toMatchObject({
    mode: 'subscription', line_items: [{ price: 'price_pro_y', quantity: 1 }], client_reference_id: 'u2',
    subscription_data: { metadata: { user_id: 'u2' } }, customer_email: 'tester@x.com', automatic_tax: { enabled: true },
    success_url: 'http://localhost/plans/done?session_id={CHECKOUT_SESSION_ID}', cancel_url: 'http://localhost/plans' });
});
it('reuses the Stripe customer of an earlier subscription', async () => {
  vi.mocked(customerIdOf).mockResolvedValueOnce('cus_1');
  await buy({ plan: 'agency', interval: 'month' });
  expect(create.mock.calls[0][0]).toMatchObject({ customer: 'cus_1', customer_update: { address: 'auto', name: 'auto' } });
  expect(create.mock.calls[0][0]).not.toHaveProperty('customer_email');
});
it('sends an account that already pays to Manage billing, without opening Checkout', async () => {
  /* session account has subscription: live pro */
  const res = await buy({ plan: 'agency', interval: 'month' });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe("You're already on the Pro plan. Change it from Manage billing in Settings.");
  expect(create).not.toHaveBeenCalled();
});
it('refuses the owner, other plans and other intervals', async () => {
  /* owner → 400 "Your account has no limits, so there's no plan to buy." */
  for (const body of [{ plan: 'owner', interval: 'month' }, { plan: 'free', interval: 'month' }, { plan: 'pro', interval: 'week' }, null])
    expect((await buy(body)).status).toBe(400);
});
it("says billing isn't set up without a key or a price", async () => { /* stripeClient → null: 503; prices.list → { data: [] }: 503 */ });
it('answers 502 when Stripe fails', async () => { create.mockRejectedValueOnce(new Error('stripe down')); expect((await buy({ plan: 'pro', interval: 'month' })).status).toBe(502); });

// portal.test.ts
it("opens the portal for the account's customer and returns to Settings", async () => {
  vi.mocked(customerIdOf).mockResolvedValue('cus_1');
  await open({});
  expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'http://localhost/settings#plan' });
});
it('returns to the plans page when asked, with the portal configuration when one is set', async () => {
  vi.stubEnv('STRIPE_PORTAL_CONFIGURATION', 'bpc_1');
  await open({ returnTo: 'plans' });
  expect(portalCreate.mock.calls[0][0]).toEqual({ customer: 'cus_1', return_url: 'http://localhost/plans', configuration: 'bpc_1' });
});
it('says there is nothing to manage before a first purchase', async () => {
  vi.mocked(customerIdOf).mockResolvedValue(null);
  const res = await open({});
  expect([res.status, (await res.json()).error]).toEqual([404, "There's no billing to manage yet. Choose a plan first."]);
});

// plans/done route.test.ts
it("saves the account's own Checkout and goes back to the plans page", async () => {
  const res = await GET(new NextRequest('http://localhost/plans/done?session_id=cs_test_a1B2'));
  expect(syncCheckoutSession).toHaveBeenCalledWith(fake, 'cs_test_a1B2', 'u2');
  expect([res.status, res.headers.get('location')]).toEqual([303, 'http://localhost/plans?subscribed=1']);
});
it('never asks Stripe about a malformed session id', async () => {
  await GET(new NextRequest('http://localhost/plans/done?session_id=../../x'));
  expect(syncCheckoutSession).not.toHaveBeenCalled();
});
it('still goes back to the plans page when the sync fails', async () => {
  vi.mocked(syncCheckoutSession).mockRejectedValueOnce(new Error('stripe down'));
  expect((await GET(new NextRequest('http://localhost/plans/done?session_id=cs_test_1'))).status).toBe(303);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/api/billing "app/(app)/plans" app/api/__tests__ app/_shared/lib/config`
Expected: FAIL. The routes don't exist.

- [ ] **Step 3: Write the three routes and add the route constants.**

- [ ] **Step 4: Run them and watch them pass.** Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing "app/(app)/plans/done" app/_shared/lib/config app/api/__tests__/requiresAccount.test.ts
git commit -m "feat: an account can buy Pro or Agency through Stripe Checkout and manage it in Stripe's billing portal"
```

---

### Task 6: Buying from the plans page, and billing in Settings

**Files:**
- Create:
  - `app/_shared/components/auditely/billing/billingRequest.ts`
  - `app/_shared/components/auditely/billing/billingButton.tsx`
  - `app/_shared/lib/billing/billingCopy.ts`
- Modify:
  - `app/_shared/components/auditely/plansView/plansView.tsx`
  - `app/(app)/plans/page.tsx`
  - `app/_shared/components/auditely/settingsView/settingsView.tsx`
  - `app/(app)/settings/page.tsx`
  - `app/_shared/lib/usage/usageCopy.ts`
- Test:
  - `app/_shared/components/auditely/__tests__/billingRequest.test.ts`
  - `app/_shared/lib/billing/__tests__/billingCopy.test.ts`
  - `app/_shared/lib/usage/__tests__/usageCopy.test.ts`
  - `app/_shared/components/auditely/__tests__/plansView.test.ts`
  - `app/_shared/components/auditely/__tests__/settingsView.test.ts`

**Interfaces:**
- Consumes:
  - `API_ROUTES.BILLING_CHECKOUT` and `API_ROUTES.BILLING_PORTAL` (Task 5);
  - `billingReady` (Task 3);
  - `Subscription` and `BillingInterval` (Task 1).
- Produces:
  - `formatBillingDate(iso: string): string` in `usageCopy.ts` formats a date as "Nov 14, 2026", in UTC.
  - `subscriptionNote(sub: Subscription): string` in `billingCopy.ts`. It checks the cases in this order:
    - `past_due` → `` `You're on the ${name} plan, but the last payment didn't go through. Update your card in Manage billing to keep it.` ``
    - `endsAt` is set → `` `You're on the ${name} plan until ${formatBillingDate(endsAt)}. It won't renew.` ``
    - otherwise → `` `You're on the ${name} plan, billed ${monthly|yearly}. It renews on ${formatBillingDate(periodEnd)}.` ``
  - `openBilling(url: string, body: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }>` POSTs JSON.
    - It answers `ok` only for a 2xx response whose `url` starts with `https://`.
    - On any other answer, it uses the server's `error`, or "Couldn't open Stripe. Try again."
    - On a network failure, it uses "Couldn't reach Auditely. Check your connection and try again."
  - `BillingButton({ label, url, body, variant = 'primary' }: { label: string; url: string; body: unknown; variant?: 'primary' | 'outline' })` is a `'use client'` component.
    - While the request runs, it shows `isLoading` and is disabled. This is what stops a double click opening two Checkouts.
    - On success it calls `window.location.assign(url)`.
    - On failure it shows the error below the button with `role="alert"`.
  - `PlansView({ summary, billing }: { summary: UsageSummary | null; billing: PlansBilling })` stays a server-renderable component. It has a new prop type:

    ```ts
    export interface PlansBilling {
      /** STRIPE_SECRET_KEY is set; without it the paid plans say "Coming soon", as today */
      ready: boolean;
      /** The owner never buys */
      canBuy: boolean;
      subscription: Subscription | null;
      /** The interval Checkout buys: /plans?billing=yearly picks yearly */
      interval: BillingInterval;
      /** Back from Checkout (/plans?subscribed=1) */
      justSubscribed: boolean;
    }
    ```

    - **Buying state.** Buying is open when the account is ready, can buy and has no subscription. The page then shows two links, "Monthly" (`/plans`) and "Yearly" (`/plans?billing=yearly`). The selected one has `aria-current="true"`, and the hint "Two months free with yearly billing." goes beside them. Each paid column shows:
      - monthly: "$24 a month";
      - yearly: "$240 a year" with "Two months free";
      - a `BillingButton` "Choose Pro" / "Choose Agency" with the body `{ plan, interval }`.
    - **Subscriber state.**
      - There's no toggle, and each column shows both prices as today.
      - The subscribed column's button is "Manage billing" (portal, `{ returnTo: 'plans' }`).
      - The other paid column's button is "Change plan" (portal, `{ returnTo: 'plans' }`).
    - **Not ready:** each paid column shows "Coming soon", as today.
    - **The owner:** no button and no "Coming soon".
    - **After Checkout** (`justSubscribed`):
      - with a subscription, the notice reads `` `You're on the ${name} plan. Your new allowances start today.` ``;
      - without one, it reads "Payment received. Your plan shows here once Stripe confirms it. Refresh the page in a minute."
  - `app/(app)/plans/page.tsx` takes `searchParams: Promise<Record<string, string | string[] | undefined>>` and builds `PlansBilling`:
    - `ready: billingReady()`;
    - `canBuy: !!session && !session.account.isOwner`;
    - `subscription: session?.account.subscription ?? null`;
    - `interval: billing === 'yearly' ? 'year' : 'month'`;
    - `justSubscribed: subscribed === '1'`.

    Its header comment no longer says "Coming soon".
  - `SettingsViewProps` gains `subscription: Subscription | null` and `billingReady: boolean`. The Plan section:
    - **The owner:** unchanged.
    - **A subscription:** the lead is `subscriptionNote(subscription)` plus `<SeePlans />`. When billing is ready, the right-hand side is a `BillingButton` "Manage billing" (outline, `{ returnTo: 'settings' }`).
    - **Otherwise:** unchanged, "You're on the X plan." plus `<SeePlans />`.

    `settings/page.tsx` passes `account.subscription ?? null` and `billingReady()`.

- [ ] **Step 1: Write the failing tests**

```ts
// usageCopy.test.ts
it('formats a billing date with its year', () => expect(formatBillingDate('2027-03-14T09:30:00.000Z')).toBe('Mar 14, 2027'));

// billingCopy.test.ts — `yearly` as in Task 2
it('says when a subscription renews, ends, or needs a new card', () => {
  expect(subscriptionNote(yearly)).toBe("You're on the Pro plan, billed yearly. It renews on Mar 14, 2027.");
  expect(subscriptionNote({ ...yearly, endsAt: '2026-11-14T09:30:00.000Z' })).toBe("You're on the Pro plan until Nov 14, 2026. It won't renew.");
  expect(subscriptionNote({ ...yearly, status: 'past_due' }))
    .toBe("You're on the Pro plan, but the last payment didn't go through. Update your card in Manage billing to keep it.");
});

// billingRequest.test.ts — stub global fetch
it("hands back Stripe's page, or the server's message", async () => {
  fetchMock.mockResolvedValueOnce(json(200, { url: 'https://checkout.stripe.com/c/1' }));
  expect(await openBilling('/api/billing/checkout', { plan: 'pro', interval: 'month' })).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/1' });
  fetchMock.mockResolvedValueOnce(json(409, { error: 'You’re already on the Pro plan.' }));
  expect(await openBilling('/x', {})).toEqual({ ok: false, error: 'You’re already on the Pro plan.' });
});
it('refuses a page that is not https, and says when Auditely is unreachable', async () => {
  fetchMock.mockResolvedValueOnce(json(200, { url: 'javascript:alert(1)' }));
  expect((await openBilling('/x', {})).ok).toBe(false);
  fetchMock.mockRejectedValueOnce(new TypeError('offline'));
  expect(await openBilling('/x', {})).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
});

// plansView.test.ts — render(summary, billing) with renderToStaticMarkup; free summary; base billing { ready: true, canBuy: true, subscription: null, interval: 'month', justSubscribed: false }
it('lets a Free account choose Pro or Agency, monthly by default', () => {
  const html = render(free, base);
  expect(html).toContain('Choose Pro'); expect(html).toContain('Choose Agency'); expect(html).toContain('$24 a month');
  expect(html).toContain('href="/plans?billing=yearly"'); expect(html).not.toContain('Coming soon');
});
it('shows yearly prices when yearly is picked', () => {
  const html = render(free, { ...base, interval: 'year' });
  expect(html).toContain('$240 a year'); expect(html).toContain('$590 a year'); expect(html).toContain('Two months free');
});
it('sends a subscriber to Manage billing instead of Checkout', () => {
  const html = render(proSummary, { ...base, subscription: yearly });
  expect(html).toContain('Manage billing'); expect(html).toContain('Change plan');
  expect(html).not.toContain('Choose Pro'); expect(html).not.toContain('billing=yearly');
});
it('keeps "Coming soon" until Stripe is set up, and shows the owner no button', () => {
  expect(render(free, { ...base, ready: false })).toContain('Coming soon');
  const owner = render(ownerSummary, { ...base, canBuy: false });
  expect(owner).not.toContain('Choose'); expect(owner).not.toContain('Coming soon');
});
it('welcomes a new subscriber, or says the payment is on its way', () => {
  expect(render(proSummary, { ...base, subscription: yearly, justSubscribed: true })).toContain("You're on the Pro plan. Your new allowances start today.");
  expect(render(free, { ...base, justSubscribed: true })).toContain('Payment received. Your plan shows here once Stripe confirms it.');
});

// settingsView.test.ts — the file's helper gains subscription and billingReady
it("shows a subscriber's renewal date and Manage billing", () => {
  const html = renderSettings({ plan: 'pro', subscription: yearly, billingReady: true });
  expect(html).toContain('It renews on Mar 14, 2027.'); expect(html).toContain('Manage billing');
});
it('shows a Free account only its plan and the plans link', () => {
  const html = renderSettings({ plan: 'free', subscription: null, billingReady: true });
  expect(html).toContain("You're on the Free plan."); expect(html).not.toContain('Manage billing');
});
```

The plans view's existing tests gain `billing: base`, and their expectations stay as they are. The one that expects "Coming soon" uses `ready: false`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run app/_shared/components/auditely app/_shared/lib/billing app/_shared/lib/usage`
Expected: FAIL. The modules and props don't exist.

- [ ] **Step 3: Write `billingRequest.ts`, `billingButton.tsx`, `billingCopy.ts` and `formatBillingDate`, and change the two views and their pages.**

- [ ] **Step 4: Run them and watch them pass**, then run `npx tsc --noEmit` and `npx vitest run`.
Expected: PASS, and no type errors.

- [ ] **Step 5: Look at it.** In the running dev server, open `/plans` and `/plans?billing=yearly` signed in as a Free tester, with `STRIPE_SECRET_KEY` unset and then set to a dummy `sk_test_x`. Without a signed-in session at hand, render `PlansView` with the test's props into a scratch page instead, and delete that page afterwards. Take screenshots at 1280 and 390 pixels wide:
  - the toggle;
  - the buttons;
  - "Coming soon" when the key is unset;
  - no sideways scroll at 390 pixels.

Clicking "Choose Pro" with the dummy key shows the 502 message under the button. Restore `.env.local` afterwards.

- [ ] **Step 6: Commit**

```bash
git add app/_shared/components/auditely app/_shared/lib/billing app/_shared/lib/usage "app/(app)/plans/page.tsx" "app/(app)/settings/page.tsx"
git commit -m "feat: the plans page buys Pro or Agency, monthly or yearly, and Settings shows the renewal date and Manage billing"
```

---

### Task 7: Stripe setup script and setup doc

**Files:**
- Create:
  - `scripts/stripeCatalog.mjs`
  - `scripts/stripeSetup.mjs`
  - `docs/billing-setup.md`
- Modify: `.env.local.example`
- Test: `app/__tests__/stripeCatalog.test.ts`

**Interfaces:**
- Consumes:
  - `PLANS` (`plans.ts`);
  - `lookupKey`, `PAID_PLANS` and `INTERVALS` (Task 1);
  - `WEBHOOK_EVENTS` (Task 1).
- Produces:
  - `stripeCatalog.mjs` exports:
    - `CATALOG`, an array of `{ plan, productId: 'auditely_' + plan, name: 'Auditely Pro' | 'Auditely Agency', prices: [{ interval: 'month' | 'year', unitAmount, lookupKey }] }`. The amounts are in cents.
    - `WEBHOOK_EVENTS_FOR_SETUP`, the same six event names.
  - `stripeSetup.mjs` runs with `node --env-file=.env.local scripts/stripeSetup.mjs [--webhook <url> --secret-out <file>]`, using `STRIPE_SECRET_KEY`. It is idempotent:
    1. Products: retrieve by `productId`, and create one with that id when Stripe answers 404.
    2. Prices: `prices.list({ lookup_keys: [key] })`. A price whose amount and interval both match is kept. Otherwise it creates `{ product, currency: 'usd', unit_amount, recurring: { interval }, lookup_key, transfer_lookup_key: true, tax_behavior: 'exclusive' }`.
    3. The portal configuration. It updates `STRIPE_PORTAL_CONFIGURATION` when that is set, else creates one. The configuration allows:
       - invoice history;
       - payment method update;
       - customer updates of email, address and name;
       - cancel `at_period_end`;
       - switching between the four prices, with `proration_behavior: 'create_prorations'`.

       It prints `STRIPE_PORTAL_CONFIGURATION=<id>`.
    4. With `--webhook` it creates an endpoint for the six events. It writes the signing secret to `--secret-out` with mode `0o600`, and prints only "Webhook signing secret written to <file>". `--webhook` without `--secret-out` exits 1 before calling Stripe.
    5. It warns "Stripe Tax isn't active: Dashboard, Settings, Tax" when `tax.settings.retrieve()` isn't `active`.

    It never prints a key or a secret. Price and configuration IDs aren't secret.
  - `docs/billing-setup.md` gives the order to follow:
    1. Run `2026-10-30-subscriptions.sql`.
    2. In Stripe test mode, activate Stripe Tax (head office address), and add registrations where the owner collects.
    3. Run the script with `--webhook https://auditely.vercel.app/api/stripe/webhook --secret-out <file>`.
    4. Add to Vercel, for Production and Preview as two separate commands:
       - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, both Sensitive, each from a file that is then deleted;
       - `STRIPE_PORTAL_CONFIGURATION`.
    5. Merge and deploy.
    6. Make a test purchase with the card `4242 4242 4242 4242`:
       - the plan shows on `/plans` and in Settings;
       - the portal switches it and cancels it.
    7. At launch, repeat steps 2–4 with live-mode keys.

    The doc also says that the webhook only reaches production, and that Preview purchases sync through `/plans/done`.
  - `.env.local.example` gains the three names with one-line comments. The `PLAN_OVERRIDES` comment becomes "Testers' plans without paying: email:plan pairs…".

- [ ] **Step 1: Write the failing test**

```ts
// app/__tests__/stripeCatalog.test.ts
import { CATALOG, WEBHOOK_EVENTS_FOR_SETUP } from '../../scripts/stripeCatalog.mjs';
it("charges what the plans page shows, under the app's lookup keys", () => {
  expect(CATALOG.map((p) => p.plan)).toEqual(PAID_PLANS);
  for (const { plan, prices } of CATALOG) {
    // The .mjs catalog's plan infers as string under tsc
    const id = plan as PaidPlanId;
    expect(prices).toEqual([
      { interval: 'month', unitAmount: PLANS[id].monthlyPrice! * 100, lookupKey: lookupKey(id, 'month') },
      { interval: 'year', unitAmount: PLANS[id].yearlyPrice! * 100, lookupKey: lookupKey(id, 'year') },
    ]);
  }
});
it('subscribes the webhook to exactly the events it handles', () => {
  expect([...WEBHOOK_EVENTS_FOR_SETUP].sort()).toEqual([...WEBHOOK_EVENTS].sort());
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/__tests__/stripeCatalog.test.ts`
Expected: FAIL. The module doesn't exist.

- [ ] **Step 3: Write the catalog, the script, the doc and the env example.**

- [ ] **Step 4: Run the test and watch it pass.** Then:
  - run `node scripts/stripeSetup.mjs --webhook https://x.invalid/api/stripe/webhook` with no `--secret-out` and no key set: it exits 1 with a usage line and calls nothing;
  - run `npx vitest run`, `npx tsc --noEmit` and `npm run lint`.

  Expected: PASS, the usage line, and no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts docs/billing-setup.md .env.local.example app/__tests__/stripeCatalog.test.ts
git commit -m "feat: one script sets up Auditely's Stripe products, prices, billing portal and webhook"
```

---

## After the last task

1. Run the whole-branch review with the Review Focus above.
2. The owner puts a **test-mode** secret key in `.env.local` as `STRIPE_SECRET_KEY=sk_test_…`, never in the chat, and activates Stripe Tax in test mode.
3. With the owner's go-ahead:
   - run `2026-10-30-subscriptions.sql` on the Auditely Supabase project through the Management API;
   - run `scripts/stripeSetup.mjs` with the webhook flags;
   - add the three Stripe variables to Vercel, test mode, for Production and Preview;
   - then merge and deploy, in the order `docs/billing-setup.md` gives.
4. The owner makes one test purchase, a plan switch and a cancel, as `docs/billing-setup.md` step 6 describes. Live keys wait for the launch (Phase 5), with sign-ups closed until then.
