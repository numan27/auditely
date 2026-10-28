# Launch setup

Launching opens Auditely to everyone. Anyone can then sign up, buy a plan, and run one free audit from the
home page without an account. Signed-out visitors see the landing page at `/` instead of `/demo`, and
search engines are let in.

One switch does all of that: `SIGNUPS_OPEN=true` on Production (step 11). Everything before it gets the
accounts, payments and free audits ready while the site is still closed. Do the steps in order. Each one
ends with what you should see once it's done; don't go on until you do.

Below, `<domain>` stands for the domain you buy in step 2, such as `auditely.app`.

## 1. Vercel Pro and Supabase Pro

Vercel's Hobby plan is for non-commercial use only, and a paid product needs Pro. Supabase's free plan
pauses a project after a week without traffic, and its limits are small.

- Vercel → your team → Settings → Billing: upgrade to Pro.
- Supabase → your organization → Billing: upgrade to Pro.

Done when: Vercel's team settings say Pro, and Supabase's organization billing says Pro.

## 2. The name and the domain

Check "Auditely" for trademarks before buying the domain: search the USPTO's trademark search
(tmsearch.uspto.gov) for it in software and online services. A conflicting live mark means picking another
name now, while nothing public uses it.

Then buy the domain, and add it in Vercel → the Auditely project → Settings → Domains → Add. Vercel shows
the DNS records to set at your registrar. Point them straight at Vercel: don't put a proxying CDN in front
(such as Cloudflare with its proxy on). Vercel would then see the CDN's address instead of each visitor's,
so every visitor would share one free audit, and BotID would lose the signals it reads. Then set Auditely's address, for Production and Preview:

```sh
printf %s https://<domain> | vercel env add SITE_URL production --no-sensitive
printf %s https://<domain> | vercel env add SITE_URL preview --no-sensitive
```

Redeploy (Vercel → Deployments → the latest Production one → Redeploy). Free accounts' reports now invite
their readers to `https://<domain>`, and the sitemap and search engines use it. Until `SITE_URL` is set,
or if it isn't a whole `https://` address, Auditely keeps using `https://auditely.vercel.app`.

Done when: Vercel shows the domain as Valid Configuration, `https://<domain>` opens Auditely, and
`https://<domain>/sitemap.xml` lists `https://<domain>/` addresses.

## 3. Supabase Auth on the domain

Supabase → Authentication → URL Configuration:

- Site URL: `https://<domain>`
- Redirect URLs: add `https://<domain>/**`. Keep the `auditely.vercel.app` and `localhost` ones.

Then move the sign-in email sender to the domain. Make a mailbox on it with your mail provider (for
example `hello@<domain>`), and follow its instructions to verify the domain (SPF and DKIM records). Then
Supabase → Authentication → SMTP Settings: set the sender email to that mailbox, the sender name to
`Auditely`, and the host, port, username and app password your provider gives for it.

Done when: a sign-in link sent from `https://<domain>/login` to an address that isn't on the Supabase team
arrives from `hello@<domain>`, not in spam, and opening it signs you in on `https://<domain>`.

## 4. Google sign-in on the domain

> Hidden in the app for the beta. Set `GOOGLE_SIGN_IN_HIDDEN` to `false` in
> `app/_shared/lib/auth/googleSignIn.ts` first, or the button won't show.

Google Cloud console → APIs & Services:

- Credentials → your OAuth client → Authorized JavaScript origins: add `https://<domain>`. Leave the
  authorized redirect URI as it is: Google sends people back to Supabase
  (`https://<project-ref>.supabase.co/auth/v1/callback`), not to the domain.
- Branding: set the application home page to `https://<domain>`, the privacy policy link to
  `https://<domain>/privacy` and the terms link to `https://<domain>/terms`, and add `<domain>` as an
  authorized domain.
- Audience: if the publishing status is still "Testing", publish the app, so anyone can sign in, not only
  its test users.

Done when: Continue with Google on `https://<domain>/login` signs you in with an account that isn't a test
user.

## 5. Stripe in live mode

Follow `docs/billing-setup.md` step 7, with the webhook on the domain:
`--webhook https://<domain>/api/stripe/webhook`.

Once sign-ups open in Production, a `sk_test_` key turns billing off by itself: the paid plans on `/plans`
then say "Coming soon", and the logs say `STRIPE_SECRET_KEY is a test key while sign-ups are open in
production`. So this step has to come before step 11.

Done when: in live mode, Developers → Webhooks shows one endpoint, on `https://<domain>`; the test-mode
endpoint is gone; and `/plans` shows the prices with Choose Pro and Choose Agency.

## 6. Paid email lookups and checks

Today's Hunter, Snov and Verifalia keys are on free plans: about 150 email lookups a month and 25 checks
a day in all, shared by every account. Pro and Agency include 100 and 400 email lookups a month each, so buy paid plans:

- Hunter (hunter.io → Subscription) and Snov (app.snov.io → Pricing): a plan with enough credits for your
  expected accounts.
- Verifalia (verifalia.com → client area → Billing): a credit pack. One check is used per email sent.

If a provider gives you a new key with the plan, replace it in Vercel (`vercel env rm`, then
`vercel env add`) for Production and Preview.

Done when: each provider's dashboard shows the paid plan and its credits, under the keys Vercel has.

## 7. Your legal details

The Terms and the Privacy Policy name who runs Auditely. Fill in the five values in
`app/_shared/lib/config/legal.ts`: your legal name, a contact email, a mailing address, the state whose
law governs the Terms, and the date they take effect. Commit and deploy as usual. Both pages are a
plain-language draft: have a lawyer read them before launch.

Don't open sign-ups while any value is still in `[BRACKETS]`.

Done when: this prints `0`, and `/terms`, `/privacy` and the footer show your details, with no brackets:

```sh
grep -c "'\[" app/_shared/lib/config/legal.ts
```

## 8. Run the free-audits migration

Supabase → SQL Editor → New query: paste all of `docs/migrations/2026-10-31-free-audits.sql` and run it.
It's safe to run again, and it runs as one transaction: an error changes nothing.

One message means it stopped before changing anything: **"Other policies would show free audits to an
account: …"**. Delete each policy it names in Authentication → Policies, then run it again.

Done when: it says "Success. No rows returned".

## 9. Turn on free audits

Free audits need four variables. The salt is a secret, so write it to a file only you can read:

```sh
(umask 077; openssl rand -base64 32 | tr -d '\n' > ~/free-audit-salt.txt)
vercel env add FREE_AUDIT_IP_SALT production < ~/free-audit-salt.txt
vercel env add FREE_AUDIT_IP_SALT preview < ~/free-audit-salt.txt
rm ~/free-audit-salt.txt
```

Then the daily cap (how many free audits all visitors share each day, from midnight UTC) and the window
(how many days one visitor's network waits before another), for Production and Preview:

```sh
printf %s 200 | vercel env add FREE_AUDIT_DAILY_CAP production --no-sensitive
printf %s 200 | vercel env add FREE_AUDIT_DAILY_CAP preview --no-sensitive
printf %s 30 | vercel env add FREE_AUDIT_WINDOW_DAYS production --no-sensitive
printf %s 30 | vercel env add FREE_AUDIT_WINDOW_DAYS preview --no-sensitive
printf %s true | vercel env add FREE_AUDIT_ENABLED production --no-sensitive
printf %s true | vercel env add FREE_AUDIT_ENABLED preview --no-sensitive
```

Redeploy Production. `GOOGLE_PAGESPEED_API_KEY` and `AUTH_SECRET` are already set; free audits need them
too. Changing the cap or the window later needs only a redeploy. A new salt lets every visitor have
another free audit, and `FREE_AUDIT_ENABLED=false` hides the field and asks visitors to sign up instead.

Done when: Settings → Free audits says "0 of 200 free audits used today." If it says "Free audits aren't
set up", it names the variables still missing.

## 10. Look at the landing page on a Preview

Set sign-ups open for Preview only:

```sh
vercel env rm SIGNUPS_OPEN preview
printf %s true | vercel env add SIGNUPS_OPEN preview --no-sensitive
```

Then redeploy a Preview (Vercel → Deployments → the latest Preview one → Redeploy), so it picks the value up.

Vercel keeps Preview deployments behind its own sign-in (Deployment Protection), so only your team can
open them. Open the Preview's address in a browser where you're signed in to Vercel but signed out of
Auditely. Read the page on your phone and your computer, in light and dark. Run one free audit there,
from your home or office network: it shares the database with Production, so it counts toward today's
cap and your network's free audit.

Done when: the landing page shows; the free audit gives a report in about a minute; and Settings → Free
audits on Production lists it.

## 11. Open sign-ups

```sh
vercel env rm SIGNUPS_OPEN production
printf %s true | vercel env add SIGNUPS_OPEN production --no-sensitive
```

Redeploy Production.

Done when: in a private window, `https://<domain>` shows the landing page, `/signup` asks for an email,
and `https://<domain>/robots.txt` allows `/` and names `https://<domain>/sitemap.xml`.

## 12. Smoke test

1. On your phone, on mobile data rather than Wi-Fi, open `https://<domain>`, paste a site you know and
   choose Audit it. A report shows in about a minute, and Settings → Free audits lists it as Not kept.
2. On the phone, choose Sign up free, and sign up with an email you've never used with Auditely. The
   sign-in link arrives from `hello@<domain>`. You land in the workspace, the "Audit a website" tab has the
   site you audited, and Settings → Free audits now lists it as Kept.
3. As that new account, open `/plans`, choose Pro monthly and pay with a real card. Back on `/plans`, it
   says you're on the Pro plan.
4. In the Stripe Dashboard, in live mode: Payments → that payment → Refund. Then Customers → that customer
   → the subscription → Cancel subscription → Immediately. The account's Settings → Plan says it's on the
   Free plan again.

Done when: all four went as described. If one didn't, set `SIGNUPS_OPEN=false` on Production and
redeploy, which closes sign-ups again, while you fix it.
