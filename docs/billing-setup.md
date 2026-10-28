# Billing setup

Accounts can now buy Pro or Agency themselves, monthly or yearly, through Stripe Checkout. Stripe Tax adds
US sales tax from the billing address. Each account manages its plan in Stripe's billing portal, opened
from Settings or the plans page. There it can switch plans, cancel, change its card and download
invoices. An upgrade, or a switch from monthly to yearly, takes effect at once and is charged then. A
downgrade, or a switch from yearly to monthly, waits for the end of the period already paid for.

Stripe tells Auditely about every new, changed or cancelled subscription through a webhook, and that is
what sets an account's plan. `PLAN_OVERRIDES` still gives testers a plan without paying, but a paid
subscription comes first. Free allowances renew every 30 days from sign-up. A paid plan's
allowances reset each month on the day it was bought, yearly plans included.

Until `STRIPE_SECRET_KEY` is set, the plans page says "Coming soon", as it does now. Sign-ups stay closed:
only `ALLOWED_EMAILS` can sign in and buy.

Do everything in Stripe's test mode first. Live keys wait for the launch (step 7).

## 1. Run the subscriptions migration

Run it after `docs/migrations/2026-10-29-settings.sql`, and before the deploy.

Supabase → SQL Editor → New query: paste all of `docs/migrations/2026-10-30-subscriptions.sql` and run it.
"Success. No rows returned" means it's done. It's safe to run again, and it runs as one transaction: an
error changes nothing.

Until it has run, every account reads as having no subscription, and the webhook fails. Stripe then
retries each event, for a few hours in test mode and up to three days in live mode.

One message means it stopped before changing anything: **"Other policies would show one account's rows
to another: …"**. The `subscriptions` table has a policy besides `own_subscription`, often from a
dashboard template. Delete each one it names in Authentication → Policies, then run it again.

## 2. Turn on Stripe Tax, in test mode

In the Stripe Dashboard, switch to test mode. Then go to Settings → Tax:

1. Add your head office address.
2. Set the preset product tax code to software as a service (SaaS) for business use.
3. Add a registration for each state where you collect sales tax.

Without registrations, Checkout still works but charges no tax.

Then Settings → Billing → Revenue recovery → Retries: set "If all retries for a payment fail" to cancel the
subscription. Stripe retries a failed renewal for a few weeks, and the account keeps its plan meanwhile.
Without this, an account whose card never goes through keeps its paid plan unpaid, period after period.

## 3. Run the setup script

Copy the test secret key from Developers → API keys. Add it to `.env.local` as
`STRIPE_SECRET_KEY=sk_test_…`. Then run:

```sh
node --env-file=.env.local scripts/stripeSetup.mjs --webhook https://auditely.vercel.app/api/stripe/webhook --secret-out ~/stripe-webhook-secret.txt
```

It creates the Auditely Pro and Auditely Agency products and their four prices, and the billing portal's
settings. It also creates the webhook, and writes the webhook's signing secret to that file, readable
only by you. It prints what it did, ending with a line like `STRIPE_PORTAL_CONFIGURATION=bpc_…`. Add that
line to `.env.local` as well. It also warns you if Stripe Tax isn't active yet.

It's safe to run again: it keeps what already matches. A second run finds the webhook already there and
writes no new secret, because Stripe shows a signing secret only once. If you lose the file, delete the
endpoint in Developers → Webhooks and run it again.

## 4. Add the variables to Vercel

Stripe's events only reach production (`auditely.vercel.app`). A purchase on a Preview deployment is
saved when Checkout returns to that deployment's `/plans/done`. Both environments still need all three
variables.

Copy the secret key again, and save it to a file only you can read, without typing it into the terminal:

```sh
(umask 077; pbpaste > ~/stripe-key.txt)
```

Then add each variable to Production and Preview. Production and Preview are separate commands, and both
secrets stay Sensitive, Vercel's default:

```sh
vercel env add STRIPE_SECRET_KEY production < ~/stripe-key.txt
vercel env add STRIPE_SECRET_KEY preview < ~/stripe-key.txt
vercel env add STRIPE_WEBHOOK_SECRET production < ~/stripe-webhook-secret.txt
vercel env add STRIPE_WEBHOOK_SECRET preview < ~/stripe-webhook-secret.txt
printf %s bpc_… | vercel env add STRIPE_PORTAL_CONFIGURATION production --no-sensitive
printf %s bpc_… | vercel env add STRIPE_PORTAL_CONFIGURATION preview --no-sensitive
rm ~/stripe-key.txt ~/stripe-webhook-secret.txt
```

Put the `bpc_…` id from step 3 in place of `bpc_…`. It isn't a secret.

## 5. Merge and deploy

Merge and deploy as usual. The plans page now shows Monthly and Yearly, and Choose Pro and Choose Agency.

## 6. Make a test purchase

Your own account has no limits and can't buy a plan, so sign in as a tester from `ALLOWED_EMAILS`.

1. Open `/plans` and choose Pro. In Checkout, pay with the card `4242 4242 4242 4242`, any future date,
   any CVC and a US billing address.
2. Back on `/plans`, it says "You're on the Pro plan. Your new allowances start today." Settings → Plan
   says when it renews.
3. Under Agency, choose Change plan and switch to Agency yearly. Back on `/plans`, the Agency column says
   Your plan. Refresh if it still says Pro: Stripe's event can take a few seconds.
4. Choose Manage billing and cancel. Settings now says "You're on the Agency plan until" the end of the
   year paid for, then "It won't renew."

In the Stripe Dashboard, Developers → Webhooks → the endpoint lists each event with a 200 answer.

## 7. At launch: live mode

Repeat steps 2 to 4 with the Dashboard in live mode and a live secret key. The script then creates the
live products, prices, portal settings and webhook. Give it your domain's webhook address,
`--webhook https://<domain>/api/stripe/webhook` (`docs/launch-setup.md` step 5). In Vercel, replace the
three variables rather than adding them: `vercel env rm` each one, then add it again.

Four things differ from the test-mode run, in this order:

1. **Before the live run, remove the `STRIPE_PORTAL_CONFIGURATION=…` line from `.env.local`.** The script
   updates the portal settings that line names, and the test-mode ones don't exist in live mode, so it
   stops with an error. Without the line it creates live ones and prints their `bpc_…` id; put that back
   in `.env.local` and in Vercel.
2. **Switch Production and Preview together.** They share one database, so a Preview still on test keys
   would record test subscriptions next to live ones.
3. **Once the live deploy is serving, clear the test subscriptions** in the Supabase SQL Editor with
   `delete from public.subscriptions;`. Test-mode subscriptions don't exist in live mode: otherwise testers
   keep their test plan, and their test customer can't open a live Checkout. Clearing them earlier lets
   the test webhook write them back.
4. **Delete the test-mode webhook endpoint.** In test mode, Developers → Webhooks → the endpoint → Delete
   destination. Its events would otherwise keep reaching production, where the live signing secret
   refuses them.
