# Google place data: the 30-day rule

Google's terms for Places data let Auditely keep a place's **place id** for good, but its other details
(name, address, website, phone, rating and review count) for **30 days**. Auditely now works that way:

- **A search under 30 days old** opens as before, and running it again reuses it at no cost.
- **A search over 30 days old** is marked "over 30 days old" in Saved searches. Opening it shows
  "This search is over 30 days old" with a **Refresh this search** button, instead of its leads.
- **Refreshing** (that button, or running the same search again) asks Google afresh and counts as one
  search. Each business Google still lists updates the row it had, so its audit, report, contacts and CRM
  state stay with it. New businesses are added. Ones Google no longer lists stay hidden.
- **Websites added by URL and audit requests** aren't from Google: they're never hidden or blanked.
- **The daily job** (`/api/cron/place-data`, 04:00 UTC, set in `vercel.json`) blanks the details of
  every business over 30 days old, keeping its place id and audit. It is **off** until you turn it on:
  until then it only logs how many businesses it would blank.

The steps below are yours, in this order.

## 1. Run the place-data migration

Supabase → SQL Editor → New query → paste `docs/migrations/2026-11-01-place-data.sql` → Run.

It adds `businesses.place_id`. Until it has run, Auditely saves businesses without Google's id and matches
them on a refresh by their website, or by name and address. The logs say so once per save:
`[places] businesses has no place_id column`.

Done when: a new search, run after the migration, saves its businesses with a `place_id`.

## 2. Set CRON_SECRET on Production

Vercel sends it to the daily job as its bearer token. Without it the job answers 503 and does nothing.

```sh
openssl rand -hex 32 > /tmp/cron-secret
vercel env add CRON_SECRET production < /tmp/cron-secret
rm /tmp/cron-secret
```

Redeploy Production.

Done when: the next morning, the Production logs show
`[place-data] N businesses have Google details over 30 days old. PLACE_DATA_ERASE is off, so they're kept.`

## 3. Refresh the old searches you want to keep

**Do this before step 4.** Businesses saved before the migration have no place id. Once their details are
blanked, a refresh can't recognise them, so their audits stay hidden for good, and Google's businesses
come back as new leads with no audit.

On 2026-10-29, **760 businesses in 14 searches** were over 30 days old, and 1,175 will be within a week.
Open Saved searches, and for each "over 30 days old" search you still need, open it and choose Refresh
this search. Each counts as one search (the owner's account has no limit).

## 4. Turn on the daily blanking

When you're ready, and only after steps 1 to 3:

```sh
printf %s on | vercel env add PLACE_DATA_ERASE production --no-sensitive
```

Redeploy Production.

Done when: the next morning, the logs show
`[place-data] Blanked Google's details on N businesses over 30 days old`.

To stop it again, remove `PLACE_DATA_ERASE` and redeploy. Blanked details don't come back, except by
refreshing their search.

## What else holds Google's details

These aren't blanked by the job. Decide whether they need to be:

- **CSV and Google Sheets exports**: once downloaded or sent, they're outside Auditely.
- **The demo's sample search** (`app/_shared/lib/demo/`) is Google data checked into the code.
- **Notifications** and **AI reports** may quote a business's name.
- **HubSpot**: leads sent there carry their name, address, website and phone.
