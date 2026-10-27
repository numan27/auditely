# Plans and Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every account has a plan (Free, Pro or Agency) with monthly allowances for searches, audits and paid email lookups. Each costly call is checked against the allowance before it goes out, and the app shows what's left and offers an upgrade where a limit stops an action.

**Architecture:** The plan numbers live in one client-safe config file (`usage/plans.ts`), with the copy in `usage/usageCopy.ts`. A server module (`usage/usage.ts`) gives each request a `Meter`. `meter.claim(kind)` reserves one use in a `usage_events` ledger through an atomic Postgres function before the costly call, and `release()` gives it back when the call never really happened. The routes refuse at the limit with a 402 that carries the limit. In the browser, a `UsageProvider` holds this month's summary for the header meter and opens one upgrade dialog wherever a 402 or a plan-only feature stops an action.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.2.3, `@supabase/supabase-js` 2.118, vitest 5, Tailwind 4. Postgres 17 is installed locally (`/usr/local/opt/postgresql@17/bin`) for a scratch check of the migration.

**Spec:** `docs/superpowers/specs/2026-10-27-public-launch-design.md`. This plan is Phase 2, "Plans and limits". It builds on the Phase 1 branch `accounts` (`docs/superpowers/plans/2026-10-28-accounts-and-isolation.md`), which isn't merged yet.

## Scope

**In Phase 2:**
- usage counting;
- the Free, Pro and Agency allowances;
- "Audit all" and export reserved for paid plans;
- the header meter;
- upgrade prompts;
- a `/plans` page to send them to.

**Not in Phase 2:**
- Stripe, `subscriptions`, and monthly windows anchored on a subscription's start date: Phase 4. Until then every plan counts calendar months.
- Sending email, Verifalia checks and HubSpot: these stay owner-only until per-user settings exist (Phase 3).
- The 30-day expiry of Google place details and the "Refresh this search" button: the spec gives them no phase. When "Refresh this search" is built, it claims `'search'` like a new search. This phase does carry the one part of that rule that decides what counts: a saved search is reused only while it's under 30 days old.

## Global Constraints

**Allowances (spec, Plans, verbatim):**

| | Free | Pro | Agency |
|---|---|---|---|
| Price | $0 | $24/mo | $59/mo (yearly: two months free) |
| Lead searches / month | 1 | 25 | 80 |
| Website audits / month | 5 | 250 | 1,000 |
| Paid email lookups / month | 0 (free site scan only) | 100 | 400 |
| "Audit all", CSV / Google Sheets export | — | ✓ | ✓ |

**Limit rules (spec):**
- Limits are hard. At the limit, the action is refused with "You've used your 25 searches this month. They reset on Nov 14." and an upgrade link. There's no overage billing.
- Limits are checked before the costly call.
- One email lookup is one business on which a paid provider credit was spent, however many providers the cascade tried.
- The automatic lookup after a search stops at the allowance. "Find email" asks first when none are left.
- Usage is counted per calendar month in UTC (the spec's period for Free). Phase 4 adds subscription-anchored windows.

**The owner and testers:**
- The owner's account keeps everything it has today: unlimited, never counted, and it never touches `usage_events`. So the owner's account works before the usage migration has run.
- Testers get a plan through `PLAN_OVERRIDES` until Stripe exists. Everyone else is on Free.

**Code rules:**
- `serviceDb` stays in the files listed in `app/__tests__/serviceDbUsage.test.ts`. This plan adds exactly one: `app/_shared/lib/usage/usage.ts`.
- Signed-in users may read their own `usage_events` rows and nothing more. Only the service role writes them.
- UI copy:
  - sentence case and plain verbs;
  - errors say what happened and what to do next, with no apologies;
  - no `→` in link text.
- Tests use vitest with fake clients. Never connect to the real Supabase project.
- Code follows the file around it: the comment density, the `// app/...` path header line, and the `@/app/...` imports.
- Commit messages follow the repo's voice: `feat:` plus what the user now gets, in plain English. They end with the attribution trailer the dispatch gives.

## Review Focus

1. **One Free account firing ten searches at once** (a script, or a double click). Exactly one goes out. The claim's count-then-insert must be atomic per user and kind: Task 2's scratch-Postgres check runs 10 claims in parallel against a limit of 3 and expects 3 rows.
2. **An Agency month with more than 1,000 usage rows.** PostgREST returns at most 1,000 rows, so the meter must count with `count: 'exact', head: true` per kind, never by listing rows. Task 2 pins this.
3. **The month boundary.**
   - An event at `2026-10-31T23:59:59Z` belongs to October.
   - The reset is `2026-11-01T00:00:00Z`.
   - December rolls over to January of the next year.

   Task 1 pins all three.
4. **Code deployed before the usage migration has run.** The owner works unchanged. Any other account gets a 503 ("Couldn't check this month's allowance. Try again in a minute."), never a crash and never a free pass. Task 2 pins this.
5. **A costly call that fails.**
   - A Google Places error, or a failed save, releases the search.
   - An audit of an unreachable site still counts, because PageSpeed ran.
   - Releasing a failed audit would leave an unlimited path to the shared PageSpeed quota.

   Tasks 3 and 4 pin this.

---

### Task 1: Plans, periods and limit copy

**Files:**
- Create: `app/_shared/lib/usage/plans.ts`, `app/_shared/lib/usage/usageCopy.ts`
- Modify: `.env.local.example` (add `PLAN_OVERRIDES=` under the accounts block, with a comment line: `# Testers' plans until Stripe: email:plan pairs, comma-separated (plan is free, pro or agency)`)
- Test: `app/_shared/lib/usage/__tests__/plans.test.ts`, `app/_shared/lib/usage/__tests__/usageCopy.test.ts`

**Interfaces:**
- Consumes: `Account` from `app/_shared/lib/auth/account.ts`.
- Produces (both files are client-safe, with no server imports):
  - `plans.ts`:
    - `type UsageKind = 'search' | 'audit' | 'email_lookup'` and `USAGE_KINDS: readonly UsageKind[]`, in that order.
    - `type PlanId = 'free' | 'pro' | 'agency' | 'owner'`.
    - `type Feature = 'auditAll' | 'export'`.
    - `interface Plan { id: PlanId; name: string; monthlyPrice: number | null; yearlyPrice: number | null; limits: Record<UsageKind, number | null>; features: Record<Feature, boolean> }`, where a `null` limit means unlimited.
    - `PLANS: Record<PlanId, Plan>`.
    - `PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'agency']`, the plans `/plans` shows. Each one is the upgrade from the one before.
    - `interface LimitReached { kind: UsageKind; plan: PlanId; limit: number; resetsAt: string }`, where `resetsAt` is an ISO string.
    - `interface UsageSummary { plan: PlanId; resetsAt: string; usage: Record<UsageKind, { used: number; limit: number | null }> }`.
    - `parsePlanOverrides(value: string | undefined): Map<string, PlanId>`.
    - `planFor(account: Pick<Account, 'email' | 'isOwner'>, env?: NodeJS.ProcessEnv): Plan`.
    - `usagePeriod(now: Date): { start: Date; end: Date }`.
    - `planHas(plan: PlanId, feature: Feature): boolean`.
    - `exhausted(summary: UsageSummary, kind: UsageKind): LimitReached | null`.
    - `readLimit(body: unknown): LimitReached | null`.
  - `usageCopy.ts`:
    - `formatResetDate(iso: string): string`;
    - `limitMessage(limit: LimitReached): string`;
    - `upgradeHint(limit: LimitReached): string | null`;
    - `featureMessage(feature: Feature): string`;
    - `meterLabel(summary: UsageSummary): { text: string; empty: boolean } | null`.

**`PLANS` values:**

| Plan | name | monthlyPrice | yearlyPrice | limits (search, audit, email_lookup) | auditAll, export |
|---|---|---|---|---|---|
| `free` | `'Free'` | 0 | 0 | 1, 5, 0 | false, false |
| `pro` | `'Pro'` | 24 | 240 | 25, 250, 100 | true, true |
| `agency` | `'Agency'` | 59 | 590 | 80, 1000, 400 | true, true |
| `owner` | `'Owner'` | null | null | null, null, null | true, true |

**Rules the tests below pin:**
- **`parsePlanOverrides`:** splits on commas, then on the last `:`. It trims and lowercases both sides, and accepts only `free`, `pro` and `agency`, so `owner` can't be granted. It skips malformed entries.
- **`planFor`:** the owner gets `owner`; an override comes next; everyone else gets `free`.
- **`usagePeriod`:** the calendar month in UTC.
- **`exhausted`:** returns a `LimitReached` only when the kind's limit is greater than 0 and `used >= limit`.
- **`readLimit`:** returns the `limit` field of a 402 response body when its shape is valid (a known kind and plan, a numeric limit and a string `resetsAt`), and null otherwise.

- [ ] **Step 1: Write the failing tests**

```ts
// plans.test.ts
describe('parsePlanOverrides', () => {
  it('reads email:plan pairs, trimmed and lowercased', () => {
    expect(parsePlanOverrides(' Ann@X.com : PRO , bob@y.com:agency')).toEqual(
      new Map([['ann@x.com', 'pro'], ['bob@y.com', 'agency']]));
  });
  it('skips blanks, unknown plans and owner', () => {
    expect(parsePlanOverrides('a@x.com:gold, ,b@x.com,c@x.com:owner,d@x.com:free')).toEqual(new Map([['d@x.com', 'free']]));
    expect(parsePlanOverrides(undefined)).toEqual(new Map());
  });
});
describe('planFor', () => {
  const env = { PLAN_OVERRIDES: 'ann@x.com:pro' } as NodeJS.ProcessEnv;
  it('gives the owner no limits, whatever the overrides say', () => {
    expect(planFor({ email: 'ann@x.com', isOwner: true }, env).id).toBe('owner');
    expect(Object.values(PLANS.owner.limits)).toEqual([null, null, null]);
  });
  it('gives an overridden tester their plan, whatever the case', () =>
    expect(planFor({ email: 'ANN@x.com', isOwner: false }, env).id).toBe('pro'));
  it('puts everyone else on Free', () => expect(planFor({ email: 'zed@x.com', isOwner: false }, env).id).toBe('free'));
});
describe('PLANS', () => {
  it('holds the spec allowances', () => {
    expect(PLANS.free.limits).toEqual({ search: 1, audit: 5, email_lookup: 0 });
    expect(PLANS.pro.limits).toEqual({ search: 25, audit: 250, email_lookup: 100 });
    expect(PLANS.agency.limits).toEqual({ search: 80, audit: 1000, email_lookup: 400 });
    expect([PLANS.pro.monthlyPrice, PLANS.pro.yearlyPrice, PLANS.agency.monthlyPrice, PLANS.agency.yearlyPrice]).toEqual([24, 240, 59, 590]);
    expect(planHas('free', 'auditAll') || planHas('free', 'export')).toBe(false);
    expect(planHas('pro', 'export') && planHas('agency', 'auditAll')).toBe(true);
  });
});
describe('usagePeriod', () => {
  it('is the calendar month in UTC', () => {
    const { start, end } = usagePeriod(new Date('2026-10-31T23:59:59Z'));
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
  it('starts a new month at midnight UTC', () =>
    expect(usagePeriod(new Date('2026-11-01T00:00:00Z')).start.toISOString()).toBe('2026-11-01T00:00:00.000Z'));
  it('rolls December into January', () =>
    expect(usagePeriod(new Date('2026-12-15T12:00:00Z')).end.toISOString()).toBe('2027-01-01T00:00:00.000Z'));
});
describe('exhausted', () => {
  const summary = (used: number, limit: number | null): UsageSummary => ({
    plan: 'pro', resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: 0, limit: 25 }, audit: { used: 0, limit: 250 }, email_lookup: { used, limit } },
  });
  it('names the limit once it is used up', () =>
    expect(exhausted(summary(100, 100), 'email_lookup')).toEqual({ kind: 'email_lookup', plan: 'pro', limit: 100, resetsAt: '2026-11-01T00:00:00.000Z' }));
  it('is null with some left, for unlimited, and for a kind the plan never had', () => {
    expect(exhausted(summary(99, 100), 'email_lookup')).toBeNull();
    expect(exhausted(summary(5, null), 'email_lookup')).toBeNull();
    expect(exhausted(summary(0, 0), 'email_lookup')).toBeNull();
  });
});
describe('readLimit', () => {
  const limit = { kind: 'audit', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };
  it('reads the limit from a 402 body', () => expect(readLimit({ error: 'x', limit })).toEqual(limit));
  it('ignores anything else', () => {
    expect(readLimit({ error: 'x' })).toBeNull();
    expect(readLimit(null)).toBeNull();
    expect(readLimit({ limit: { ...limit, kind: 'pdf' } })).toBeNull();
    expect(readLimit({ limit: { ...limit, limit: '5' } })).toBeNull();
  });
});
```

```ts
// usageCopy.test.ts
const reached = (over: Partial<LimitReached> = {}): LimitReached =>
  ({ kind: 'search', plan: 'pro', limit: 25, resetsAt: '2026-11-14T00:00:00.000Z', ...over });

describe('limitMessage', () => {
  it('says how many were used and when they reset, in the spec words', () =>
    expect(limitMessage(reached())).toBe("You've used your 25 searches this month. They reset on Nov 14."));
  it('groups thousands', () =>
    expect(limitMessage(reached({ kind: 'audit', plan: 'agency', limit: 1000, resetsAt: '2026-12-01T00:00:00.000Z' })))
      .toBe("You've used your 1,000 audits this month. They reset on Dec 1."));
  it('reads naturally for an allowance of one', () =>
    expect(limitMessage(reached({ plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' })))
      .toBe("You've used this month's search. You get another on Nov 1."));
  it('says when the plan never had any', () =>
    expect(limitMessage(reached({ kind: 'email_lookup', plan: 'free', limit: 0 }))).toBe("Email lookups aren't part of the Free plan."));
});
describe('formatResetDate', () => {
  it('uses the UTC date, not the local one', () => expect(formatResetDate('2026-11-01T00:00:00.000Z')).toBe('Nov 1'));
});
describe('upgradeHint', () => {
  it("names the next plan's allowance", () => {
    expect(upgradeHint(reached({ plan: 'free', limit: 1 }))).toBe('Pro gives you 25 searches a month.');
    expect(upgradeHint(reached())).toBe('Agency gives you 80 searches a month.');
    expect(upgradeHint(reached({ kind: 'email_lookup', plan: 'free', limit: 0 }))).toBe('Pro gives you 100 email lookups a month.');
  });
  it('has nothing above Agency', () => expect(upgradeHint(reached({ plan: 'agency', limit: 80 }))).toBeNull());
});
describe('featureMessage', () => {
  it('names the plans that have it', () => {
    expect(featureMessage('auditAll')).toBe('Audit all comes with the Pro and Agency plans.');
    expect(featureMessage('export')).toBe('Exporting to CSV and Google Sheets comes with the Pro and Agency plans.');
  });
});
describe('meterLabel', () => {
  const summary = (search: number, audit: number, plan: PlanId = 'free'): UsageSummary => ({
    plan, resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: search, limit: PLANS[plan].limits.search }, audit: { used: audit, limit: PLANS[plan].limits.audit }, email_lookup: { used: 0, limit: PLANS[plan].limits.email_lookup } },
  });
  it('shows the allowance closest to running out, audits on a tie', () => {
    expect(meterLabel(summary(0, 0))).toEqual({ text: '5 of 5 audits left this month', empty: false });
    expect(meterLabel(summary(0, 2))).toEqual({ text: '3 of 5 audits left this month', empty: false });
  });
  it('says none are left', () => expect(meterLabel(summary(1, 2))).toEqual({ text: 'No searches left this month', empty: true }));
  it('never goes below zero', () => expect(meterLabel(summary(0, 9))?.text).toBe('No audits left this month'));
  it('shows nothing for an account without limits', () => expect(meterLabel(summary(3, 3, 'owner'))).toBeNull());
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/lib/usage`
Expected: FAIL with "Cannot find module '@/app/_shared/lib/usage/plans'"

- [ ] **Step 3: Implement both files**

**Nouns:** `{ search: ['search', 'searches'], audit: ['audit', 'audits'], email_lookup: ['email lookup', 'email lookups'] }`. Use the plural except where `limit === 1` (or `left === 1` of a limit of 1), as the tests show.

**Dates and numbers:**
- `formatResetDate`: `toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })`.
- Numbers: `toLocaleString('en-US')`.

**`upgradeHint`:** looks at the plans after `limit.plan` in `PLAN_ORDER`. It returns the first one whose limit for the kind is larger, as `` `${name} gives you ${n} ${plural} a month.` ``.

**`featureMessage`:** `` `${FEATURE_NAMES[feature]} comes with the ${names} plans.` ``
- `FEATURE_NAMES`: `{ auditAll: 'Audit all', export: 'Exporting to CSV and Google Sheets' }`.
- `names` lists the `PLAN_ORDER` plans that have the feature, joined "A and B" (or "A, B and C").

**`meterLabel`:** only kinds whose limit is greater than 0 count. It picks the lowest `left / limit`, breaking ties in the order audit, search, email_lookup. `left` is `Math.max(0, limit - used)`. `left === 0` gives `` `No ${plural} left this month` `` with `empty: true`; otherwise it reads `` `${left} of ${limit} ${noun} left this month` ``.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/_shared/lib/usage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/usage .env.local.example
git commit -m "feat: Free, Pro and Agency allowances in one place, with the words for each limit"
```

---

### Task 2: The usage ledger

**Files:**
- Create:
  - `docs/migrations/2026-10-28-usage.sql`
  - `app/_shared/lib/usage/usage.ts`
  - `app/api/usage/route.ts`
  - `docs/plans-setup.md`
- Modify:
  - `docs/supabase-schema.sql`: the same table, policy, grants and function, for a fresh install. No stray-policy guard.
  - `app/_shared/lib/config/routes.ts`: add `USAGE: '/api/usage'` to `API_ROUTES`.
  - `app/__tests__/serviceDbUsage.test.ts`: add `'app/_shared/lib/usage/usage.ts'` to `ALLOWED`, keeping it sorted, and add "the usage ledger" to the header comment.
  - `app/api/__tests__/requiresAccount.test.ts`: add `usage: () => import('@/app/api/usage/route')`.
- Test:
  - `app/_shared/lib/usage/__tests__/usage.test.ts`
  - `app/api/usage/__tests__/route.test.ts`

**Interfaces:**
- Consumes: from Task 1, `planFor`, `usagePeriod`, `PLANS`, `USAGE_KINDS`, `LimitReached`, `UsageSummary` and `UsageKind`; also `Db` and `serviceDb` (`supabase/client.ts`), `Account`, and `getSession`/`unauthorized` (`supabase/server.ts`).
- Produces (`usage.ts`, server-only):
  - `type Claim = { ok: true; release: () => Promise<void> } | { ok: false; status: 402 | 503; error: string; limit?: LimitReached }`.
  - `interface Meter`, with two methods:
    - `claim(kind: UsageKind): Promise<Claim>`;
    - `notOnPlan(kind: UsageKind): LimitReached | null`.
  - `const UNMETERED: Meter`: `claim` is always `{ ok: true }` with a release that does nothing, and `notOnPlan` is always `null`.
  - `meterFor(account: Account, now?: () => Date): Meter`.
  - `usageSummary(db: Db, account: Account, now?: Date): Promise<UsageSummary | null>`.
  - `refusal(claim: Extract<Claim, { ok: false }>): NextResponse`, which answers `{ error, limit }` with the claim's status.
  - `GET /api/usage` answers 200 with a `UsageSummary`, 401 without a session, or 503 `{ error: "Couldn't load this month's usage." }`.

**The migration:**

The migration follows `2026-10-28-accounts.sql`:
- a header saying where to run it, that it runs after the accounts migration, and that it's safe to re-run;
- `BEGIN`/`COMMIT`;
- a stray-policy guard for `usage_events`: anything but `own_rows` raises, in the same words as the accounts guard.

Then:

```sql
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('search', 'audit', 'email_lookup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events (user_id, kind, created_at DESC);
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_rows ON usage_events;
CREATE POLICY own_rows ON usage_events FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Supabase grants new tables to anon and authenticated by default: a user may read
-- their own rows (the meter) and never write one. Only the server's service role writes.
REVOKE ALL ON usage_events FROM anon, authenticated;
GRANT SELECT ON usage_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON usage_events TO service_role;

-- One use of `kind`, recorded only while the account is under its limit for the period.
-- The lock makes count-then-insert atomic per account and kind, so ten requests at
-- once can't all see room for one. Returns the new row's id, or NULL at the limit.
CREATE OR REPLACE FUNCTION public.claim_usage(p_user_id UUID, p_kind TEXT, p_limit INTEGER, p_since TIMESTAMPTZ)
  RETURNS UUID LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE claimed UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_kind));
  IF (SELECT count(*) FROM public.usage_events
      WHERE user_id = p_user_id AND kind = p_kind AND created_at >= p_since) >= p_limit THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.usage_events (user_id, kind) VALUES (p_user_id, p_kind) RETURNING id INTO claimed;
  RETURN claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_usage(UUID, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_usage(UUID, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
```

**`meterFor(account)`:**
- For the `owner` plan it returns `UNMETERED`.
- Otherwise it reads `planFor(account)`, and `claim(kind)` works by the kind's limit:
  - `null`: ok, and nothing is recorded.
  - `0`: refused with 402 and `limitMessage(...)` from Task 1, without a database call.
  - Above 0: `serviceDb.rpc('claim_usage', { p_user_id, p_kind, p_limit, p_since })`, where `p_since` is `usagePeriod(now()).start` as an ISO string. A `null` result is refused with 402. An id is ok, and its `release` deletes that row, filtered by `id` and `user_id`, logging and swallowing any error.
  - An RPC error is refused with 503 and `"Couldn't check this month's allowance. Try again in a minute."`. It's logged as `[usage] Failed to claim ${kind}: run docs/migrations/2026-10-28-usage.sql in Supabase (${message})`.
- `notOnPlan(kind)` returns the `LimitReached` for a limit of `0`, and null otherwise.
- `resetsAt` is always `usagePeriod(now()).end` as an ISO string.

**`usageSummary(db, account)`:**
- The owner gets every kind as `{ used: 0, limit: null }`, with no queries.
- Any other account gets one query per kind that has a limit greater than 0, in parallel, with the plan's limits filled in: `db.from('usage_events').select('id', { count: 'exact', head: true }).eq('user_id', account.id).eq('kind', kind).gte('created_at', start)`.
- A kind whose limit is 0 is `{ used: 0, limit: 0 }`, with no query.
- An error from any of the queries returns null, logged with the migration name.

**`docs/plans-setup.md`** is the owner's runbook, one short page in the voice of `docs/accounts-setup.md`. It covers:
- run `docs/migrations/2026-10-28-usage.sql` once the accounts migration has run. It can go before or after the deploy: the owner's account doesn't use it, and other accounts get "Couldn't check this month's allowance" until it has run;
- `PLAN_OVERRIDES` on Vercel, then redeploy;
- where the numbers live (`app/_shared/lib/usage/plans.ts`);
- how to give a tester a fresh month in the SQL editor: `DELETE FROM usage_events WHERE user_id = (SELECT id FROM profiles WHERE email = '…');`;
- the check: sign in as a Free tester, run one search, and see "No searches left this month" in the header.

- [ ] **Step 1: Write the failing tests**

In `usage.test.ts`, mock `@/app/_shared/lib/supabase/client` with a `serviceDb` whose `rpc` is a `vi.fn()` and whose `from('usage_events').delete().eq().eq()` records its filters. The user `db` is a fake whose chained `select/eq/gte` records its arguments and resolves to `{ count, error }`. Fix `now` at `2026-10-14T09:00:00Z`.

```ts
const tester = { id: 'u2', email: 'tester@x.com', isOwner: false };
const owner = { id: 'u1', email: 'owner@x.com', isOwner: true };

it('never records the owner', async () => {
  const claim = await meterFor(owner, now).claim('search');
  expect(claim.ok).toBe(true);
  expect(rpc).not.toHaveBeenCalled();
});
it('claims through claim_usage with the plan limit and the month start', async () => {
  rpc.mockResolvedValue({ data: 'ev-1', error: null });
  const claim = await meterFor(tester, now).claim('audit');
  expect(rpc).toHaveBeenCalledWith('claim_usage', { p_user_id: 'u2', p_kind: 'audit', p_limit: 5, p_since: '2026-10-01T00:00:00.000Z' });
  expect(claim.ok).toBe(true);
});
it('refuses at the limit with the spec message and the limit', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await meterFor(tester, now).claim('search')).toEqual({
    ok: false, status: 402, error: "You've used this month's search. You get another on Nov 1.",
    limit: { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' },
  });
});
it('refuses a kind the plan never had without asking the database', async () => {
  const meter = meterFor(tester, now);
  expect((await meter.claim('email_lookup')).ok).toBe(false);
  expect(meter.notOnPlan('email_lookup')).toEqual({ kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' });
  expect(meter.notOnPlan('audit')).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});
it('fails closed with a 503 when the ledger is missing', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'function claim_usage does not exist' } });
  expect(await meterFor(tester, now).claim('search')).toEqual({ ok: false, status: 503, error: "Couldn't check this month's allowance. Try again in a minute." });
});
it('gives a claim back by deleting its own row', async () => {
  rpc.mockResolvedValue({ data: 'ev-9', error: null });
  const claim = await meterFor(tester, now).claim('audit');
  if (claim.ok) await claim.release();
  expect(deletes).toEqual([[['id', 'ev-9'], ['user_id', 'u2']]]);
});
it('counts each limited kind with a head count, never a row list', async () => {
  const summary = await usageSummary(userDb({ search: 1, audit: 3 }), tester, new Date('2026-10-14T09:00:00Z'));
  expect(summary).toEqual({ plan: 'free', resetsAt: '2026-11-01T00:00:00.000Z',
    usage: { search: { used: 1, limit: 1 }, audit: { used: 3, limit: 5 }, email_lookup: { used: 0, limit: 0 } } });
  expect(selects).toEqual([['id', { count: 'exact', head: true }], ['id', { count: 'exact', head: true }]]);
  expect(filters).toContainEqual(['gte', 'created_at', '2026-10-01T00:00:00.000Z']);
  expect(filters).toContainEqual(['eq', 'user_id', 'u2']);
});
it('summarises the owner without a query', async () => {
  expect((await usageSummary(userDb({}), owner))?.usage.search).toEqual({ used: 0, limit: null });
  expect(selects).toEqual([]);
});
it('answers null when counting fails', async () =>
  expect(await usageSummary(userDb({}, { message: 'relation "usage_events" does not exist' }), tester)).toBeNull());
```

`route.test.ts` for `/api/usage`:
- 200 with the summary for a session;
- 503 `{ error: "Couldn't load this month's usage." }` when `usageSummary` resolves null. Mock `usage.ts`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/lib/usage app/api/usage app/__tests__ app/api/__tests__`
Expected: FAIL. `usage.ts` and the route don't exist, and `serviceDbUsage` lists a file that doesn't exist yet.

- [ ] **Step 3: Write the migration, the schema lines, `usage.ts`, the route and `docs/plans-setup.md`**

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/_shared/lib/usage app/api/usage app/__tests__ app/api/__tests__`
Expected: PASS

- [ ] **Step 5: Check the migration on a scratch Postgres (nothing committed)**

1. Under `$TMPDIR`, run `initdb` and start a throwaway cluster with `pg_ctl` on a free port (`/usr/local/opt/postgresql@17/bin`).
2. Create the stand-ins Supabase provides:
   - the roles `anon`, `authenticated` and `service_role`;
   - schema `auth` with `auth.users(id uuid primary key, email text)`;
   - `auth.uid()`, returning `current_setting('request.jwt.claim.sub', true)::uuid`.
3. Run `2026-10-28-usage.sql` twice. Expected: both runs succeed.
4. As `service_role`, fire 10 `SELECT claim_usage(<user>, 'search', 3, now() - interval '1 day')` calls in parallel (10 backgrounded `psql -c` calls, then `wait`). Expected: exactly 3 rows for that user.
5. As `authenticated` with a matching `request.jwt.claim.sub`:
   - `INSERT` into `usage_events` fails;
   - `DELETE` fails;
   - `SELECT claim_usage(...)` fails with permission denied;
   - `SELECT` returns only that user's rows.
6. Add a stray `CREATE POLICY anyone ON usage_events FOR SELECT USING (true)` and rerun. Expected: the guard raises and the policy is reported by name.
7. Stop the cluster and delete its directory. Record the results in the report.

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/2026-10-28-usage.sql docs/supabase-schema.sql docs/plans-setup.md app/_shared/lib/usage app/api/usage app/_shared/lib/config/routes.ts app/__tests__/serviceDbUsage.test.ts app/api/__tests__/requiresAccount.test.ts
git commit -m "feat: each account's searches, audits and email lookups are counted against its plan, one atomic claim before each costly call"
```

---

### Task 3: Searches count

**Files:**
- Modify: `app/api/search/route.ts`
- Test: `app/api/search/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `meterFor` and `refusal` from Task 2 (`Meter.claim('search')`).
- Produces: `POST /api/search` answers 402 `{ error, limit }` at the limit. Nothing else changes in its responses.

**Flow:**
1. The reuse check now also requires `created_at >= now − 30 days`. Add a `SEARCH_REUSE_DAYS = 30` constant, with a comment saying Google's terms limit how long place details may be kept.
2. A reused search returns as it does today and is not claimed.
3. Otherwise `meterFor(account).claim('search')` runs before `searchPlaces`. A refusal returns `refusal(claim)` without calling `searchPlaces`.
4. `release()` runs when `searchPlaces` answers `!ok`, when the search insert fails, and when the businesses insert fails. A search that finds no places still counts, because Google billed it.

In the route test, mock `@/app/_shared/lib/usage/usage` so `meterFor` returns a fake meter: `claim` is a `vi.fn` resolving `{ ok: true, release }`, and `release` is a `vi.fn`. Keep `refusal` real by spreading `importOriginal`.

- [ ] **Step 1: Write the failing tests**

```ts
it('reuses only a search under 30 days old', async () => {
  await post({ niche: 'dentist', location: 'austin' });
  expect(db.state.reads[0].ranges).toEqual([['created_at', expect.any(String)]]);
  const since = db.state.reads[0].ranges[0][1] as string;
  expect(Date.now() - Date.parse(since)).toBeGreaterThan(29.9 * 864e5);
  expect(Date.now() - Date.parse(since)).toBeLessThan(30.1 * 864e5);
});
it('claims a search before calling Google', async () => { /* claim called with 'search' before searchPlaces (check call order) */ });
it('refuses at the limit without calling Google', async () => {
  meter.claim.mockResolvedValue({ ok: false, status: 402, error: "You've used this month's search. You get another on Nov 1.", limit: freeSearchLimit });
  const { status, json } = await post({ niche: 'dentist', location: 'austin' });
  expect(status).toBe(402);
  expect(json).toEqual({ error: "You've used this month's search. You get another on Nov 1.", limit: freeSearchLimit });
  expect(searchPlaces).not.toHaveBeenCalled();
  expect(db.inserts.searches).toBeUndefined();
});
it('gives the search back when Google fails', async () => { /* searchPlaces → { ok:false, status:502 } ⇒ release called once */ });
it('gives the search back when the businesses cannot be stored', async () => { /* businessInsertError ⇒ release called once */ });
it('keeps the claim for a search that finds nothing', async () => { /* places: [] ⇒ 200, release not called */ });
it('does not claim when a recent search is reused', async () => { /* cached search ⇒ claim not called */ });
```

The fake `db` records `gte` calls as `[column, value]` in a `ranges` list on each read, beside `filters`, and returns the chain. The existing `eq` recording and its assertions stay as they are.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/api/search`
Expected: FAIL. Nothing is claimed, and there's no `gte` filter.

- [ ] **Step 3: Implement it in `app/api/search/route.ts`**

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/api/search`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/search
git commit -m "feat: a new search counts against the plan, and a saved search is reused only while it's under 30 days old"
```

---

### Task 4: Audits count

**Files:**
- Modify: `app/_shared/lib/audit/auditBusiness.ts`, `app/api/audit/route.ts`
- Test: `app/api/audit/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `Meter`, `UNMETERED` and `meterFor` from Task 2.
- Produces:
  - `auditBusiness(db: Db, businessId: string, force = false, meter: Meter = UNMETERED): Promise<AuditBusinessResult>`. The failure case gains `limit?: LimitReached`: `{ ok: false; status: number; error: string; limit?: LimitReached }`.
  - `POST /api/audit` passes `meterFor(session.account)` and answers `{ error, limit }` with the result's status (402 at the limit).
- The inbound route and every other caller keep the default `UNMETERED`, so the owner's requests are never counted.

**Where the claim sits:**
- `meter.claim('audit')` runs only on the path that runs `runAudit`: after the cached-audit return, after the "no website" 400 and after the missing PageSpeed key 503, and immediately before `runAudit`.
- A refusal returns `{ ok: false, status, error, limit }`.
- `release()` runs only when the audit can't be stored, the "Failed to store audit" 500. An `AuditUnavailableError` (a 502) keeps the claim, because PageSpeed was called.

Update the file's header comment: "Run audit" counts against the plan, and devartventures.com requests don't.

- [ ] **Step 1: Write the failing tests**

The route test mocks `@/app/_shared/lib/usage/usage` with the same fake meter as Task 3.

```ts
it('serves a cached audit without claiming one', async () => { /* cached current audit ⇒ claim not called */ });
it('claims an audit before running it, a Re-audit too', async () => { /* force: true ⇒ claim('audit') once, runAudit called after */ });
it('refuses at the limit without running the audit', async () => {
  meter.claim.mockResolvedValue({ ok: false, status: 402, error: "You've used your 5 audits this month. They reset on Nov 1.", limit: freeAuditLimit });
  const { status, json } = await post({ business_id: 'biz-1' });
  expect(status).toBe(402);
  expect(json).toEqual({ error: "You've used your 5 audits this month. They reset on Nov 1.", limit: freeAuditLimit });
  expect(runAudit).not.toHaveBeenCalled();
});
it('keeps the claim when the site cannot be audited', async () => { /* AuditUnavailableError ⇒ 502, release not called */ });
it('gives the audit back when it cannot be stored', async () => { /* insert error ⇒ 500, release called once */ });
it('does not claim when the PageSpeed key is missing', async () => { /* 503, claim not called */ });
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/api/audit app/api/inbound`
Expected: the new tests FAIL, and the inbound tests still PASS.

- [ ] **Step 3: Implement it in `auditBusiness.ts` and `app/api/audit/route.ts`**

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/api/audit app/api/inbound app/api/audit-requests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/audit/auditBusiness.ts app/api/audit
git commit -m "feat: each website audit counts against the plan; a cached audit and devartventures.com requests don't"
```

---

### Task 5: Email lookups count

**Files:**
- Modify:
  - `app/_shared/lib/utils/emailApis.ts`
  - `app/_shared/lib/utils/emailFinder.ts` (remove `apiFallback`: the finder only scrapes)
  - `app/_shared/lib/utils/contactDiscovery.ts` (`discoverContacts(website)` loses its `opts`)
  - `app/api/find-emails/route.ts`
- Test:
  - `app/_shared/lib/utils/__tests__/emailApis.test.ts`
  - `app/_shared/lib/utils/__tests__/emailFinder.test.ts` (drop the `apiFallback` cases: the route test covers the paid path now)
  - `app/_shared/lib/utils/__tests__/contactDiscovery.test.ts`
  - `app/api/find-emails/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `meterFor` from Task 2 (`Meter.claim('email_lookup')` and `Meter.notOnPlan('email_lookup')`).
- Produces:
  - `interface EmailLookupResult { email: string | null; refused: boolean }`.
  - `lookupEmailViaApis(domain: string, mode: EmailLookupMode, allowPaidCall: () => Promise<boolean> = async () => true): Promise<EmailLookupResult>`.
  - `POST /api/find-emails` answers `{ results: FindResult[]; limit?: LimitReached }`.
  - The request body is unchanged: `business_ids`, `apiFallback: true` for "Find email", and `apiLookup: 'auto'` for the automatic pass.

**The gate in `emailApis.ts`:**
- `allowPaidCall` is asked at most once per `lookupEmailViaApis` call, immediately before the first request that spends a credit:
  - Hunter `domain-search`;
  - Tomba `domain-search`;
  - Snov `domain-search/domain-emails/start`;
  - Apollo `mixed_people/search`.
- The free requests never ask: Hunter `email-count`, Snov `oauth/access_token` and `get-domain-emails-count`.
- A provider without keys asks nothing.
- When `allowPaidCall` answers false, the cascade makes no more requests and returns `{ email: null, refused: true }`.
- Update the file's header comment to say what counts as one lookup.

**`find-emails/route.ts`:**
- `const meter = meterFor(account)`. When a paid lookup is wanted (`apiFallback === true`, or `apiLookup === 'auto'`) and `meter.notOnPlan('email_lookup')` returns a limit, no paid lookup runs and the response carries that `limit`.
- Otherwise each business gets its own gate, `() => meter.claim('email_lookup')`. A gate answers true on `ok`. A 402 answers false and keeps the first `LimitReached` for the response's `limit`. A 503 answers false, and is logged by `meterFor`.
- **On demand:**
  1. Scrape with `discoverContacts(website)`.
  2. If there's still no email and a gate exists, run `lookupEmailViaApis(domain, 'all', gate)`.
  3. Save `contactsUpdate(...)`, plus `emailLookupUpdate(...)` only when the cascade ran and wasn't refused.
- **Automatic:** `lookupEmailViaApis(domain, 'auto', gate)`. A refused lookup saves nothing, so `email_lookup_at` stays null and the business can be looked up next month.
- The owner (`UNMETERED`) behaves exactly as today.
- Replace the comment above `POST` that says the paid APIs are the owner's. It now says they follow the plan's allowance.

- [ ] **Step 1: Write the failing tests**

```ts
// emailApis.test.ts (fetch is already stubbed per URL in this file)
it('asks before the first paid request and stops when refused', async () => {
  hunterCount(3); // email-count says Hunter has emails for the domain
  const allow = vi.fn(async () => false);
  expect(await lookupEmailViaApis('acme.com', 'all', allow)).toEqual({ email: null, refused: true });
  expect(allow).toHaveBeenCalledTimes(1);
  expect(fetchedUrls().some((u) => u.includes('hunter.io/v2/domain-search'))).toBe(false);
  expect(fetchedUrls().some((u) => u.includes('tomba') || u.includes('apollo') || u.includes('snov'))).toBe(false);
});
it('never asks when only the free counts run', async () => {
  hunterCount(0); snovCount(0);
  const allow = vi.fn(async () => true);
  expect(await lookupEmailViaApis('acme.com', 'auto', allow)).toEqual({ email: null, refused: false });
  expect(allow).not.toHaveBeenCalled();
});
it('asks once however many providers it tries', async () => {
  hunterCount(2); hunterSearch([]); tombaSearch([]); snovCount(1); snovSearch(['info@acme.com']);
  const allow = vi.fn(async () => true);
  expect(await lookupEmailViaApis('acme.com', 'all', allow)).toEqual({ email: 'info@acme.com', refused: false });
  expect(allow).toHaveBeenCalledTimes(1);
});
```

Use or extend this file's existing fetch stubs. The helper names above are placeholders for whatever the file already has.

```ts
// find-emails route.test.ts (meterFor mocked with a fake meter; lookupEmailViaApis and discoverContacts mocked)
it('looks nothing up for a plan without email lookups, and says so', async () => {
  meter.notOnPlan.mockReturnValue(freeLookupLimit);
  const { json } = await post({ business_ids: ['b1'], apiFallback: true });
  expect(lookupEmailViaApis).not.toHaveBeenCalled();
  expect(discoverContacts).toHaveBeenCalledWith('https://acme.com');
  expect(json.limit).toEqual(freeLookupLimit);
});
it('stops the automatic pass at the allowance and leaves the rest for later', async () => {
  // five businesses; the gate each lookup gets is called; the meter allows the first 3 claims
  lookupEmailViaApis.mockImplementation(async (_d, _m, allow) => ((await allow()) ? { email: null, refused: false } : { email: null, refused: true }));
  meter.claim.mockResolvedValueOnce(okClaim).mockResolvedValueOnce(okClaim).mockResolvedValueOnce(okClaim)
    .mockResolvedValue({ ok: false, status: 402, error: '…', limit: proLookupLimit });
  const { json } = await post({ business_ids: ['b1', 'b2', 'b3', 'b4', 'b5'], apiLookup: 'auto' });
  expect(updatesWithLookupAt()).toHaveLength(3);
  expect(json.limit).toEqual(proLookupLimit);
});
it('records the one-time lookup after a manual paid lookup', async () => { /* gate ok ⇒ update has email_lookup_at */ });
it('keeps the scrape but not the lookup when the claim is refused', async () => { /* contacts saved, no email_lookup_at, json.limit set */ });
it("keeps the owner's lookups as they are", async () => { /* owner session ⇒ meter is UNMETERED (mock returns one that always allows) ⇒ paid lookup runs, no limit */ });
```

Replace the two Phase 1 tests ("never spends a paid lookup on another account's lead", "only scrapes the website for another account"). Their behavior is now the Free plan's, covered by the first test above.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/lib/utils app/api/find-emails`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement it in `emailApis.ts`, `emailFinder.ts`, `contactDiscovery.ts` and the route**

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/_shared/lib/utils app/api/find-emails`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/utils app/api/find-emails
git commit -m "feat: paid email lookups count against the plan, one per business a credit is spent on, and stop at the allowance"
```

---

### Task 6: Usage in the app: the meter and the upgrade dialog

**Files:**
- Create:
  - `app/_shared/lib/hooks/useUsage.ts`
  - `app/_shared/components/providers/UsageProvider.tsx`
  - `app/_shared/components/auditely/upgradeModal/upgradeModal.tsx`
  - `app/_shared/components/auditely/usageMeter/usageMeter.tsx`
- Modify:
  - `app/(app)/layout.tsx`
  - `app/_shared/components/auditely/appHeader/appHeader.tsx`
  - `app/_shared/lib/config/routes.ts` (add `PLANS: '/plans'` to `ROUTES`; Task 7 builds the page)
- Test: `app/_shared/components/auditely/__tests__/usage.test.ts`

**Interfaces:**
- Consumes: from Task 1, `UsageSummary`, `LimitReached`, `Feature`, `PLANS`, `meterLabel`, `limitMessage`, `upgradeHint` and `featureMessage`; from Task 2, `usageSummary` and `API_ROUTES.USAGE`.
- Produces:
  - `type UpgradePrompt = ({ limit: LimitReached } | { feature: Feature }) & { continueLabel?: string; onContinue?: () => void }`.
  - `interface Usage`, with three members:
    - `summary: UsageSummary | null`;
    - `refresh: () => void`;
    - `promptUpgrade: (prompt: UpgradePrompt) => void`.
  - `UsageContext`, and `useUsage(): Usage | null`, which is null outside the signed-in app, in the demo.
  - `<UsageProvider initial={UsageSummary | null}>`.
  - `<UpgradeModal prompt={UpgradePrompt} onClose={() => void} />`.
  - `<UsageMeter />`.

**`UsageProvider`:**
- It keeps `summary` in state, starting from `initial`.
- `refresh()` is debounced by 1,000 ms, so a run of "Audit all" asks once. It then GETs `API_ROUTES.USAGE` and replaces the summary on a 200, ignoring failures.
- `promptUpgrade(prompt)` opens `UpgradeModal` and, for a `limit` prompt, also calls `refresh()`.
- It renders the modal after `children`, as `DemoProvider` does. The context value is memoized.

**`UpgradeModal`:** uses `Modal`, `Modal.Header`, `Modal.Content` and `Modal.Footer` from `ui/modal`, like `demoNoticeModal.tsx`.
- **Title:** "Monthly limit reached" for a `limit` with `limit.limit > 0`; otherwise "Not in your plan".
- **Body:** a `limit` prompt shows `limitMessage(limit)`, then `upgradeHint(limit)` when there is one, as separate paragraphs. A `feature` prompt shows `featureMessage(feature)`.
- **Footer**, left to right:
  - "Close" (outline);
  - the `continueLabel` button (outline), when `onContinue` is set. It calls `onContinue` and closes;
  - "See plans" (primary), a `next/link` to `ROUTES.PLANS`, when the prompt is a feature or `upgradeHint` isn't null.

**`UsageMeter`:**
- It renders nothing when `useUsage()` is null or `meterLabel(summary)` is null.
- Otherwise it renders a `next/link` to `ROUTES.PLANS` with `aria-label={text}`, classes `hidden sm:inline-flex`, and the style of the header's other text links.
- The text is amber (`text-amber-700 dark:text-amber-400`) when `empty`, and `var(--color-text-secondary)` otherwise.
- `AppHeader` renders it before `NotificationBell`, outside the demo.

**Layout:** `app/(app)/layout.tsx` computes `session ? await usageSummary(session.db, session.account) : null` and wraps its children in `<UsageProvider initial={…}>`, inside `AccountProvider`. Update its header comment.

- [ ] **Step 1: Write the failing tests**

```ts
// usage.test.ts (renderToStaticMarkup, like account.test.ts)
const freeSummary = (search: number, audit: number): UsageSummary => ({ plan: 'free', resetsAt: '2026-11-01T00:00:00.000Z',
  usage: { search: { used: search, limit: 1 }, audit: { used: audit, limit: 5 }, email_lookup: { used: 0, limit: 0 } } });
const withUsage = (summary: UsageSummary | null, el: ReactElement) =>
  renderToStaticMarkup(createElement(UsageContext.Provider, { value: summary && { summary, refresh() {}, promptUpgrade() {} } }, el));

it('shows what is left and links to the plans', () => {
  const html = withUsage(freeSummary(0, 2), createElement(UsageMeter));
  expect(html).toContain('3 of 5 audits left this month');
  expect(html).toContain('href="/plans"');
});
it('warns when an allowance is used up', () => expect(withUsage(freeSummary(1, 0), createElement(UsageMeter))).toContain('No searches left this month'));
it('shows no meter without limits or outside the app', () => {
  expect(withUsage(null, createElement(UsageMeter))).toBe('');
  expect(withUsage({ ...freeSummary(0, 0), plan: 'owner', usage: { search: { used: 0, limit: null }, audit: { used: 0, limit: null }, email_lookup: { used: 0, limit: null } } }, createElement(UsageMeter))).toBe('');
});
it('explains a limit and offers the next plan', () => {
  const html = renderToStaticMarkup(createElement(UpgradeModal, { prompt: { limit: { kind: 'search', plan: 'free', limit: 1, resetsAt: '2026-11-01T00:00:00.000Z' } }, onClose() {} }));
  expect(html).toContain('Monthly limit reached');
  expect(html).toContain("You&#x27;ve used this month&#x27;s search. You get another on Nov 1.");
  expect(html).toContain('Pro gives you 25 searches a month.');
  expect(html).toContain('See plans');
});
it('offers no plans above Agency, and the way on when one is given', () => {
  const html = renderToStaticMarkup(createElement(UpgradeModal, { prompt: { limit: { kind: 'email_lookup', plan: 'agency', limit: 400, resetsAt: '2026-11-01T00:00:00.000Z' }, continueLabel: 'Search the website only', onContinue() {} }, onClose() {} }));
  expect(html).not.toContain('See plans');
  expect(html).toContain('Search the website only');
});
it('explains a paid feature', () => {
  const html = renderToStaticMarkup(createElement(UpgradeModal, { prompt: { feature: 'export' }, onClose() {} }));
  expect(html).toContain('Not in your plan');
  expect(html).toContain('Exporting to CSV and Google Sheets comes with the Pro and Agency plans.');
});
```

`Modal` renders inline while `isOpen`, with no portal, so `renderToStaticMarkup` shows its contents.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/components/auditely/__tests__/usage.test.ts`
Expected: FAIL with the module not found.

- [ ] **Step 3: Implement the hook, the provider, the modal, the meter, the header and the layout**

- [ ] **Step 4: Run the tests and see them pass, then run the type and lint checks**

Run: `npx vitest run app/_shared/components && npx tsc --noEmit && npm run lint`
Expected: PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/hooks/useUsage.ts app/_shared/components "app/(app)/layout.tsx" app/_shared/lib/config/routes.ts
git commit -m "feat: the header shows what's left this month, and one dialog explains a limit and the plan that lifts it"
```

---

### Task 7: The plans page

**Files:**
- Create: `app/_shared/components/auditely/plansView/plansView.tsx`, `app/(app)/plans/page.tsx`
- Test: `app/_shared/components/auditely/__tests__/plansView.test.ts`

**Interfaces:**
- Consumes: from Task 1, `PLANS`, `PLAN_ORDER`, `USAGE_KINDS`, `UsageSummary` and `formatResetDate`; from Task 2, `usageSummary` and `getSession`; from Task 6, `ROUTES.PLANS`.
- Produces: `<PlansView summary={UsageSummary | null} />` and the page `/plans`. The proxy already requires a session for every route that isn't public.

**`page.tsx`** is a server component. It calls `getSession()` and `usageSummary` (a missing session renders `PlansView` with `null`), sets `metadata.title` to `'Plans'`, and renders `<AppHeader />` with `<PlansView>` inside the same `main` container as `searches/page.tsx`.

**`PlansView`**, top to bottom:
1. The `h1` "Plans".
2. The lead line depends on the account:
   - an account with limits: `` `Your plan: ${name}. This month's allowances reset on ${formatResetDate(resetsAt)}.` ``;
   - the owner: "Your account has no limits.";
   - a `null` summary: "Couldn't load this month's usage. Refresh the page to try again."
3. **This month:** one row per kind whose limit is greater than 0. Each row reads `` `${used} of ${limit} ${plural} used` `` beside a thin bar: a `role="progressbar"` div with `aria-valuenow`, `aria-valuemax` and widths in `%`. The section is hidden for the owner or a `null` summary.
4. **Plans:** one column per plan in `PLAN_ORDER`, side by side from `sm` up and stacked on phones.
   - Each column shows the name and the price: "Free", or `` `$${monthlyPrice} a month` `` with `` `or $${yearlyPrice} a year` `` under it.
   - Below that, the three allowances in plain words: "1 search a month", "5 audits a month", "No email lookups" or "100 email lookups a month", using `toLocaleString('en-US')`.
   - Then "Audit all" and "CSV and Google Sheets export", each marked included or not.
   - The current plan's column carries "Your plan". Every other paid column ends with the muted text "Coming soon": no button until Stripe (Phase 4).

- [ ] **Step 1: Write the failing tests**

```ts
it('shows this month for a Free account and marks its plan', () => {
  const html = renderToStaticMarkup(createElement(PlansView, { summary: freeSummary(1, 2) }));
  expect(html).toContain('Your plan: Free. This month&#x27;s allowances reset on Nov 1.');
  expect(html).toContain('1 of 1 search used');
  expect(html).toContain('2 of 5 audits used');
  expect(html).not.toContain('email lookups used');
  expect(html).toContain('$24 a month');
  expect(html).toContain('or $590 a year');
  expect(html).toContain('1,000 audits a month');
  expect(html).toContain('Coming soon');
});
it('tells the owner there are no limits', () => {
  const html = renderToStaticMarkup(createElement(PlansView, { summary: ownerSummary }));
  expect(html).toContain('Your account has no limits.');
  expect(html).not.toContain('used</');
});
it('says when usage could not be loaded', () =>
  expect(renderToStaticMarkup(createElement(PlansView, { summary: null }))).toContain("Couldn&#x27;t load this month&#x27;s usage."));
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/components/auditely/__tests__/plansView.test.ts`
Expected: FAIL with the module not found.

- [ ] **Step 3: Implement `PlansView` and the page**

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run app/_shared/components && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/_shared/components/auditely/plansView "app/(app)/plans" app/_shared/components/auditely/__tests__/plansView.test.ts
git commit -m "feat: a plans page shows this month's usage beside what Free, Pro and Agency include"
```

---

### Task 8: Prompts for searches and audits

**Files:**
- Modify:
  - `app/_shared/lib/hooks/useLeadSearch.ts`
  - `app/_shared/lib/hooks/useBusinessAudit.ts`
  - `app/_shared/lib/utils/bulkAudit.ts`
  - `app/_shared/lib/hooks/useBulkAudit.ts`
- Test: `app/_shared/lib/utils/__tests__/bulkAudit.test.ts`

**Interfaces:**
- Consumes: `useUsage()` and `UpgradePrompt` (Task 6); `readLimit` and `planHas` (Task 1).
- Produces: `BulkDeps` gains `onLimit?: (limit: LimitReached) => void`.

**What each part does:**
- **`useLeadSearch.search`:**
  - On a non-ok answer where `readLimit(data)` returns a limit, call `usage?.promptUpgrade({ limit })`, set no `error`, and leave the form as `start()` left it.
  - After every answer, ok or not, call `usage?.refresh()`.
- **`useBusinessAudit.runAudit`:**
  - On a non-ok answer with a limit: `promptUpgrade({ limit })`, no `auditError`, and the status goes back to `audit ? 'done' : 'idle'`.
  - After an ok answer: `usage?.refresh()`.
  - The demo's `request` never returns a limit, so the demo is unchanged.
- **`bulkAudit.auditBusiness`:** when the audit answer carries a limit (`readLimit(res.data)`), call `onStage(id, { stage: 'queued' })` and `onLimit?.(limit)`, and return without writing a summary. The business isn't failed: the run's end clears queued states, as it already does.
- **`useBulkAudit`:**
  - **Feature gate:** `start(targets)` first checks `usage?.summary && !planHas(usage.summary.plan, 'auditAll')`. When that's true, it calls `usage.promptUpgrade({ feature: 'auditAll' })` and starts nothing.
  - **Stopping at the limit:** the `onLimit` it passes sets `stopRequested.current = true` and prompts once per run, with a `useRef` flag reset at the start of each run. Nothing new starts after the limit, and audits already running finish.
  - **Refreshing:** it calls `usage?.refresh()` after each finished business and at the end of the run. The provider debounces these.

- [ ] **Step 1: Write the failing tests**

```ts
// bulkAudit.test.ts
it('stops short of the summary when the plan limit is reached, without failing the business', async () => {
  const limit = { kind: 'audit', plan: 'free', limit: 5, resetsAt: '2026-11-01T00:00:00.000Z' };
  const post = vi.fn(async () => ({ ok: false, data: { error: "You've used your 5 audits this month. They reset on Nov 1.", limit } }));
  const onStage = vi.fn(); const onLimit = vi.fn();
  await auditBusiness(lead, { post, onUpdate: vi.fn(), onStage, onLimit });
  expect(onLimit).toHaveBeenCalledWith(limit);
  expect(onStage).toHaveBeenLastCalledWith(lead.id, { stage: 'queued' });
  expect(post).toHaveBeenCalledTimes(1); // no summary request
});
it('still fails a business on any other error', async () => { /* { ok:false, data:{ error:'Audit failed' } } ⇒ stage 'failed', onLimit not called */ });
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/lib/utils/__tests__/bulkAudit.test.ts`
Expected: FAIL. `onLimit` isn't called.

- [ ] **Step 3: Implement it in the four files**

- [ ] **Step 4: Run the tests, then the type and lint checks**

Run: `npx vitest run app/_shared/lib && npx tsc --noEmit && npm run lint`
Expected: PASS, with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/lib/hooks/useLeadSearch.ts app/_shared/lib/hooks/useBusinessAudit.ts app/_shared/lib/utils/bulkAudit.ts app/_shared/lib/hooks/useBulkAudit.ts app/_shared/lib/utils/__tests__/bulkAudit.test.ts
git commit -m "feat: a search or audit past the limit explains it and offers a bigger plan; Audit all stops at the limit and is a paid feature"
```

---

### Task 9: Prompts for email lookups and export

**Files:**
- Modify:
  - `app/_shared/components/auditely/businessEmail/businessEmail.tsx`
  - `app/_shared/lib/hooks/useUrlAudits.ts`
  - `app/_shared/lib/utils/emailFinderNotice.ts`
  - `app/_shared/lib/hooks/useEmailDiscovery.ts`
  - `app/_shared/components/auditely/exportMenu/exportMenu.tsx`
- Test: `app/_shared/lib/utils/__tests__/emailFinderNotice.test.ts`, `app/_shared/components/auditely/__tests__/usage.test.ts` (add the cases below)

**Interfaces:**
- Consumes: `useUsage()` (Task 6); `exhausted`, `readLimit` and `planHas` (Task 1); `limitMessage` (Task 1); the `find-emails` response `limit` (Task 5).
- Produces: `emailFinderNotice(name: string, found: ContactsFound | undefined, limit?: LimitReached | null): string`.

**"Find email" asks first when none are left.** This applies to `BusinessEmail.handleFind` and to `useUrlAudits.findEmail`, after its `addSite`.
- When `usage?.summary` and `exhausted(summary, 'email_lookup')` return a limit, call `promptUpgrade({ limit, continueLabel: 'Search the website only', onContinue: () => <the same request with apiFallback: false> })`.
- Otherwise send the request as today, with `apiFallback: true`.
- After the answer, call `usage?.refresh()`.

**Not found, limited by the plan:**
- In `BusinessEmail`, when the answer has no email and `readLimit(data)` is non-null, the row reads "No email on its website" followed by a "See plans" `next/link` to `ROUTES.PLANS`. Without a limit, it keeps "No email found. Try again".
- In the URL tab, the notice comes from `emailFinderNotice(name, found, readLimit(data))`. When no email was found and there's a limit, the notice adds one sentence at the end:
  - `' Paid plans also search email databases.'` when `limit.limit === 0`;
  - `` ` ${limitMessage(limit)}` `` otherwise.

**The automatic pass in `useEmailDiscovery`:**
- During the paid stage (`apiLookup: 'auto'`), the loop stops at the first answer where `readLimit(data)` is non-null.
- It then sets the progress to finished (`setProgress({ runKey, done, total: done })`) and calls `usage?.refresh()`.
- `post` returns the parsed body, or null when cancelled, instead of a boolean. Adjust its two callers.

**Export:** in `ExportMenu`, `downloadCsv` and `copyForSheets` check, after the demo check, `usage?.summary && !planHas(usage.summary.plan, 'export')`. When that's true, they call `usage.promptUpgrade({ feature: 'export' })` and return.

- [ ] **Step 1: Write the failing tests**

```ts
// emailFinderNotice.test.ts
const freeLimit = { kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' } as const;
const usedUp = { kind: 'email_lookup', plan: 'pro', limit: 100, resetsAt: '2026-11-14T00:00:00.000Z' } as const;
it('mentions paid plans when Free only scanned the website', () =>
  expect(emailFinderNotice('Acme', { id: 'b1', email: null, phone: null, contact_page: null, socials: {} }, freeLimit))
    .toBe('No email found for Acme, and no other contact details on its website. Paid plans also search email databases.'));
it('says the lookups ran out', () =>
  expect(emailFinderNotice('Acme', undefined, usedUp))
    .toBe("No email found for Acme, and no other contact details on its website. You've used your 100 email lookups this month. They reset on Nov 14."));
it('says nothing about plans when an email was found', () =>
  expect(emailFinderNotice('Acme', { id: 'b1', email: 'hi@acme.com', phone: null, contact_page: null, socials: {} }, freeLimit)).toBe('Found hi@acme.com for Acme.'));
```

Match the `ContactsFound` fields to the type in `useEmailDiscovery.ts`.

The export and "Find email" gates run on click, and this repo's component tests render static markup only, so there's no interaction test for them. What they decide is already tested: `planHas` and `exhausted` in Task 1, and `readLimit` and the copy in Tasks 1 and 9. The click wiring is checked by Step 4's type check and by the task review.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinderNotice.test.ts`
Expected: FAIL. The limit sentence is missing.

- [ ] **Step 3: Implement it in the five files**

- [ ] **Step 4: Run the full checks**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npx next build`
Expected: every test passes (the pre-existing `runAudit.test.ts` "pathologically nested HTML" test can time out under heavy load, so rerun that file alone if it does), with no type or lint errors and a successful build.

- [ ] **Step 5: Commit**

```bash
git add app/_shared/components/auditely/businessEmail app/_shared/lib/hooks/useUrlAudits.ts app/_shared/lib/utils/emailFinderNotice.ts app/_shared/lib/hooks/useEmailDiscovery.ts app/_shared/components/auditely/exportMenu app/_shared/lib/utils/__tests__/emailFinderNotice.test.ts app/_shared/components/auditely/__tests__/usage.test.ts
git commit -m "feat: Find email asks before searching the website alone once lookups run out, and export is a paid feature"
```
