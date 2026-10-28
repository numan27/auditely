# Accounts setup

Auditely signs people in with Supabase Auth, by an emailed link, with Google, or with a password the
account sets in Settings, instead of the shared admin password. Each account sees only its own searches, leads, audits and notifications: Row Level
Security in the database enforces that, whatever the code asks for. You (`OWNER_EMAIL`) keep all of
today's data and the Requests tab. Sign-ups stay closed: only you and the addresses in `ALLOWED_EMAILS`
can sign in.

These are the steps to switch the live app over, in order. Steps 1 to 6 don't touch the running app.
Steps 7 and 8 go back to back: once the migration has run, the running app can still read everything
but can't save new searches, sites or audit requests until the new code is live. Step 7 merges the code
before it runs the migration, so step 8 is only a push and that gap stays short.

The new code is on the `accounts` branch, not `main`.

## 1. Supabase: URL configuration

Supabase → Authentication → URL Configuration:

- Site URL: `https://auditely.vercel.app`
- Redirect URLs: add `https://auditely.vercel.app/**`, `http://localhost:3000/**` and `http://localhost:3005/**`

Sign-in links and Google come back to `/auth/callback?next=…`, and the `**` lets that path and its `?next=`
through. A return address that isn't on this list is replaced with the Site URL, which has no `?`, so
the `&token_hash=…` the email template adds (step 3) makes a broken link. Vercel preview deployments
have addresses of their own: to sign in on those too, add `https://*-<your-vercel-team>.vercel.app/**`.

Leave "Allow new users to sign up" on (Authentication → Sign In / Providers, on by default). An invited
address gets its account on its first sign-in, and Auditely itself refuses everyone else.

## 2. Google sign-in

1. Google Cloud console → APIs & Services → Credentials → Create credentials → OAuth client ID, type
   "Web application". If Google asks for a consent screen first, set one up: app name Auditely, your
   email as the support address, audience External.
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. `<project-ref>` is the
   subdomain in `SUPABASE_URL`; Supabase also shows this exact URL as the "Callback URL" on its Google page.
3. Copy the client ID and client secret into Supabase → Authentication → Providers → Google, turn it on
   and save.
4. While the consent screen's publishing status is "Testing", Google only lets its listed test users in.
   Publish it (Audience → Publish app), or add each invited address as a test user.

## 3. Email templates

Supabase → Authentication → Email Templates. In both **"Magic Link"** and **"Confirm signup"**, replace
`{{ .ConfirmationURL }}` with:

```
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
```

For example: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in to Auditely</a>`.

The link then works in any browser or on a phone, not only in the browser that asked for it. Both
templates need it: the first time an invited address signs in it has no account yet, so Supabase sends
"Confirm signup" instead of "Magic Link".

## 4. Email sending (custom SMTP)

Supabase's built-in sender only delivers to the project team's own addresses, so sign-in links to
anyone else need your mailbox. This is a stopgap until the Auditely domain exists.

Supabase → Authentication → SMTP Settings → enable custom SMTP:

- Sender email: `contact@devartventures.com`, sender name: `Auditely`
- Host: `smtp.zoho.com`, port: `465`
- Username: `contact@devartventures.com`, password: that mailbox's Zoho app password

(`smtppro.zoho.com` instead if the mailbox is on a paid Zoho plan; the wrong host answers "Access Restricted".)

## 5. Your account

Supabase → Authentication → Users → Add user → Create new user:

- Email: the address that will be `OWNER_EMAIL`
- Password: any long random one. You won't use it: sign in by link or with Google, then set your own
  in Settings → Password to sign in with a password from then on.
- Tick "Auto Confirm User".

The migration in step 7 gives today's data to this account. Sign in later with this same address, by
link or with the Google account that uses it: Supabase links Google to this account, so the data stays yours.

**Never delete your account in Authentication → Users: it permanently deletes all your searches, leads,
audits and requests.**

## 6. Vercel environment variables

Vercel → the Auditely project → Settings → Environment Variables, for **Production and Preview**:

- `SUPABASE_ANON_KEY`: Supabase → Project Settings → API Keys, the anon (or publishable) key
- `OWNER_EMAIL`: the address from step 5
- `SIGNUPS_OPEN`: `false`
- `ALLOWED_EMAILS` (optional): the other addresses that may sign in, separated by commas

Leave `ADMIN_PASSWORD` in place until step 9. New values only reach the next deployment (step 8), so the
live site doesn't change yet.

Optional, for speed: Supabase → Project Settings → JWT Keys, switch to asymmetric signing keys. Without
them, Auditely has to ask Supabase about the session on every request; with them, it checks the session
itself. If you switch, don't revoke the legacy JWT secret afterwards: the anon and service role keys
stop working without it.

## 7. Merge the code, then run the migration

First, on your computer, merge the new code into `main`. Nothing goes live until the push in step 8:

```
git checkout main
git pull
git merge accounts
```

Next, if you haven't run them yet, run `docs/migrations/2026-10-27-audit-requests.sql` and
`docs/migrations/2026-10-27-notifications.sql`, each in its own query. Both are safe to run again. The
accounts migration changes the notifications table, and the Requests tab needs `businesses.request`.

Then Supabase → SQL Editor → New query:

1. Paste all of `docs/migrations/2026-10-28-accounts.sql`.
2. On its third line, replace `owner@example.com` with your `OWNER_EMAIL`.
3. Run it. If the editor warns about destructive operations, that's the migration dropping and
   re-creating its own trigger and policies: run it anyway. "Success. No rows returned" means it's done.

It runs as one transaction: if it stops with an error, nothing was changed. "No account for …" means
step 5 isn't done, or the account's address isn't the one on line 3.

"Other policies would show one account's rows to another: …" means these tables have policies of their
own, often a dashboard template such as "Enable read access for all users". Any one of them would let an
account see another's rows. Auditely never used them: delete each one the message names in
Authentication → Policies, then run the migration again.

If the SQL editor later says "current transaction is aborted", run `ROLLBACK;` and try again.

From here until step 8 is live, the running app can't save new rows. Go straight on.

## 8. Deploy

Straight after step 7, push `main`. The push deploys production. Do it yourself, or ask Claude to:

```
git push origin main
```

If you didn't merge at the start of step 7, run its three `git` lines first.

Wait until Vercel → Deployments shows the new production deployment as Ready.

## 9. Check it

- Sign in by link, then sign out and sign in with Google.
- Your searches, URL audits and requests are all there, and so is the bell.
- An `ALLOWED_EMAILS` test account sees an empty workspace with no Requests tab.
- That account runs a niche and city you've already searched and gets a new search of its own, not
  yours. This checks Row Level Security on the real database, which no unit test can.
- A stranger's email is refused.

If every page answers with an error, `/demo` and `/report` links included, `SUPABASE_ANON_KEY` is missing
in Vercel. Add it (step 6), then redeploy (see "Adding or removing testers" below for how).

Once all of that works, remove `ADMIN_PASSWORD` from Vercel and from `.env.local`. Nothing reads it any more.

## If the deploy has to wait

If step 8 can't follow step 7 (a failed build, or you roll the deployment back), let the running app
save again: in the SQL Editor, run

```sql
ALTER TABLE searches      ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE businesses    ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
```

Rows saved meanwhile belong to no one. Straight before you deploy, run the accounts migration again
(step 7, with your address): it gives those rows to you and puts the rule back.

## Adding or removing testers

1. Vercel → the Auditely project → Settings → Environment Variables: edit `ALLOWED_EMAILS` for
   **Production and Preview**. It's the addresses that may sign in besides yours, separated by commas.
2. Redeploy: Vercel → Deployments → the latest production deployment → ⋯ → Redeploy. The change only
   takes effect once that deployment is Ready.
3. A new tester can then sign in with their address, by link or with Google. While Google's consent
   screen is still "Testing" (step 2), add them there as a test user too.

Removing an address locks that person out on their next request. Their data stays in the database until
their user is deleted in Authentication → Users, and deleting it removes their searches, leads and audits
for good.

**Never delete your account in Authentication → Users: it permanently deletes all your searches, leads,
audits and requests.**

## Local development

`.env.local` needs `SUPABASE_ANON_KEY` (already set), `OWNER_EMAIL`, and optionally `ALLOWED_EMAILS`.
Without `SIGNUPS_OPEN`, sign-ups are closed. The dev server on port 3000 or 3005 is already in the
Redirect URLs from step 1, so links and Google come back to it.

On a new database, run `docs/supabase-schema.sql` instead of the migrations: it includes the accounts
changes. Steps 1 to 6 still apply.
