# Plans setup

Every account except yours (`OWNER_EMAIL`) now has a plan, and each plan has a monthly allowance of
searches, audits and email lookups. Free is 1 search, 2 audits and no email lookups a month; Pro and
Agency give more and add Audit all and exporting. Free allowances renew every 30 days from the moment
the account was made (its `profiles.created_at`). Your own account has no limits and is never counted.

Nobody can buy a plan yet: payments come later, and `/plans` shows "Coming soon" until then. Until
then you give testers a plan yourself (step 2).

## 1. Run the usage migration

Run it once `docs/migrations/2026-10-28-accounts.sql` has run (`docs/accounts-setup.md`, step 7). It can
go before or after the deploy: your account doesn't use it, and the other accounts get "Couldn't check
your allowance. Try again in a minute." until it has run.

Supabase → SQL Editor → New query: paste all of `docs/migrations/2026-10-28-usage.sql` and run it.
"Success. No rows returned" means it's done. It's safe to run again, and it runs as one transaction: an
error changes nothing.

"Other policies would show one account's rows to another: …" means the new `usage_events` table has a
policy of its own. Delete each one the message names in Authentication → Policies, then run it again.

## 2. Give testers a plan

Vercel → the Auditely project → Settings → Environment Variables, for **Production and Preview**:

- `PLAN_OVERRIDES`: email:plan pairs separated by commas, for example
  `ann@example.com:pro, bob@example.com:agency`. The plan is `free`, `pro` or `agency`.

Everyone not listed is on Free. Redeploy afterwards (Deployments → the latest → Redeploy): a new value
only reaches the next deployment.

## Changing the numbers

The allowances, prices and what each plan includes all live in `app/_shared/lib/usage/plans.ts`
(`PLANS`). Change them there and deploy.

## Giving a tester a fresh month

Supabase → SQL Editor, with their address:

```sql
DELETE FROM usage_events WHERE user_id = (SELECT id FROM profiles WHERE email = 'tester@example.com');
```

Their header shows the full allowance again after a page refresh.

## Check it

Sign in as a Free tester (an address in `ALLOWED_EMAILS` that isn't in `PLAN_OVERRIDES`), run one
search, and the header says "No searches left until …", 30 days after the account was made. A second
search answers "You've used your search. You get another on …" and offers the plans.
