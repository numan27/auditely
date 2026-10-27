# Settings setup

Every account now has a Settings page. Each account can save the name, company, website, logo and
contact details its reports and emails are signed with. On paid plans it can also connect its own
mailbox and HubSpot.

Who a report comes from depends on the plan:

- **Your account (`OWNER_EMAIL`).** Reports keep today's DevArtVentures details wherever your profile
  is blank. Fill a field in, and that field replaces the DevArtVentures one.
- **Pro and Agency.** Reports carry the account's own name, logo and contact details.
- **Free.** Reports carry Auditely's name and invite the reader to try Auditely. A Free account can still
  save its profile, and it takes effect when the account moves to a paid plan.

Saved mailbox passwords and HubSpot tokens are encrypted before they reach the database. Only the
server can read them back.

## 1. Run the settings migration

Supabase → SQL Editor → New query: paste all of `docs/migrations/2026-10-29-settings.sql` and run it.
"Success. No rows returned" means it's done. It's safe to run again, and it runs as one transaction: an
error changes nothing.

It can go before the deploy: today's code ignores the new columns and table. Until it has run, Settings
can't save anything. You see "Settings need the latest database update: run
docs/migrations/2026-10-29-settings.sql in Supabase.", and everyone else sees "Settings can't be saved
right now. Try again later."

Two messages mean it stopped before changing anything:

- **"Policies on user_secrets would let a signed-in user read saved passwords: …"** The new
  `user_secrets` table has a policy, often from a dashboard template such as "Enable read access for
  all users". That table must have none. Delete each one the message names in Authentication →
  Policies, then run it again.
- **"Other policies would show one account's rows to another: …"** `profiles` has a policy besides
  `own_profile` and `own_profile_update`. Delete each one it names, then run it again.

## 2. Add the encryption key

On your own computer, run:

```sh
openssl rand -base64 32
```

Vercel → the Auditely project → Settings → Environment Variables, for **Production and Preview**:

- `SECRETS_KEY`: the value that command printed.

Keep it the same from now on. A new key can't read anything saved under the old one, so every account
would have to connect its mailbox and HubSpot again. Without the key, Settings can save profiles but
not mailboxes or HubSpot tokens.

## 3. Deploy, then fill in your profile

Deploy as usual. Then open Settings and fill in whatever you want your reports to say. This step is
optional: with a blank profile, your reports and emails stay exactly as they are today.

## 4. What testers can do now

A tester on a paid plan (`PLAN_OVERRIDES`, `docs/plans-setup.md`) can:

- put their own name, logo and contact details on reports;
- send outreach from their own mailbox, so each email lands in their Sent folder;
- hand leads to their own HubSpot.

A Free tester can save a profile, but their reports keep Auditely's name.

## Check it

Sign in as a Pro tester, open Settings, enter a company name and save. Open a lead's PDF report: the
company name is on the cover, and the "next step" box gives the tester's contact details.
