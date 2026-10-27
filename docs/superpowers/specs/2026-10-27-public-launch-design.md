# Public Launch — Design Spec

**Date:** 2026-10-27
**Status:** Draft, owner's questions answered; waiting for approval
**Project:** take Auditely from a single-admin tool to a freemium product anyone can sign up for and pay for.

## Background

Auditely today is one person's tool. `proxy.ts` puts every page and API route behind `ADMIN_PASSWORD`; the
database has no notion of who owns a row; the PDF report, outreach emails and HubSpot handoff all use the owner's
own details (`REPORT_CONTACT_*`, the Zoho mailbox, `HUBSPOT_TOKEN`). Logged-out visitors on `/` are sent to `/demo`,
a read-only replay of a saved search.

What it does is valuable to two kinds of people:

- **Freelancers and agencies** who sell web work: search local businesses by type and city, audit each one's
  website (speed, SEO, mobile, SSL, AI-search readiness), and send a ready-written outreach email with a PDF report.
- **Business owners** who want to know what's wrong with their own website.

### What each action costs

| Action | Service | Rough cost per use |
|---|---|---|
| Lead search | Google Places Text Search (5 sub-queries, up to ~100 places) | ~$0.15–0.20 (5 Enterprise-tier calls; check current Maps Platform pricing and free monthly allowance) |
| Website audit | PageSpeed Insights + page fetch | $0 (free API, 25k/day quota), plus function time |
| AI summary + cold email | Groq `openai/gpt-oss-120b` | well under $0.01 |
| Email lookup (paid) | Hunter, Snov, Tomba, Apollo credits | ~$0.03–0.10 per credit, by plan |
| Contact discovery | Scraping the business's own site | $0 |

Lead searches and paid email lookups are what cost money; audits are nearly free. Limits follow that.

## Goals

1. Anyone can sign up, free, with an email link or Google, and use Auditely with their own private data.
2. A visitor can audit one website for free without signing up: the product sells itself from the landing page.
3. A short, minimal landing page that works for both audiences and leads to the free audit and to sign-up.
4. A Free plan with a small monthly allowance, and paid plans through Stripe, each with a fair-use limit that matches
   its price.
5. The owner's account keeps everything it has today (all existing data, the Requests tab and the devartventures.com
   integration), and no other user ever sees any of it.
6. A visual polish pass over the app: one design language from landing page to workspace.

## Non-goals

- Teams, shared workspaces or seats. One account, one person.
- An affiliate or referral programme, coupons beyond what Stripe offers out of the box.
- A mobile app. The web app stays responsive.
- Changing what the audit measures. (Who the report and email are from does change: see per-user settings.)
- Migrating off Google Places at launch (see Risks).

## Anti-goals (would make the launch a failure even if it works)

- One user seeing another user's searches, leads, audits, emails or notifications.
- An unlimited free path that lets a bot or one person run up the Google Places or email-finder bill.
- A landing page that reads like every other SaaS template: gradient blobs, a wall of feature cards, stock
  testimonials.
- Outreach email sent from a shared Auditely address: one user's cold email would wreck every user's deliverability.

## Decisions

Items marked **(owner)** were decided by the owner; the rest are the designer's calls, open to change.

| Decision | Choice | Why |
|---|---|---|
| Audience **(owner)** | Both agencies and business owners | The free audit serves owners; lead search serves agencies |
| Model **(owner)** | Freemium: a Free plan with a small monthly allowance | |
| Billing **(owner)** | Stripe at launch | |
| Paid limits **(owner)** | Every paid plan has a fair-use limit sized to its price | |
| Accounts **(owner, suggested)** | Supabase Auth | Already the database; RLS can enforce who sees what |
| Sign-in methods | Email magic link and Google | No passwords to store or reset; Google is one click for most |
| Data isolation | `user_id` on every user-owned table, RLS policies `user_id = auth.uid()`, and API routes use a per-request Supabase client signed in as the user | Two locks: a missed filter in a route still returns nothing. The service-role client is kept for webhooks, the inbound route and jobs only |
| The owner | The existing data is assigned to the owner's new account; `OWNER_EMAIL` names the owner | Nothing is lost; the owner signs in like everyone else |
| Requests tab and inbound route | Owner-only | They belong to devartventures.com |
| URLs | App views keep today's addresses (`/search/{id}`, `/audit`, `/requests/{id}`). `/` shows the landing page when signed out and the workspace when signed in | Shipped links keep working |
| `/demo` | Kept, linked from the landing page as "See a sample search" | It already shows lead search without signing up |
| Free single audit | On the landing page, no sign-up: one real audit per visitor | See "Free audit" below |
| Plans and prices (proposal) | **Free** $0 · **Pro** $24/mo · **Agency** $59/mo (yearly: two months free) | See "Plans" below; numbers live in one config file |
| Usage period | Calendar month for Free. Paid plans: monthly windows counted from the subscription's start date, yearly plans included | A yearly plan can't spend twelve months of searches in one |
| Email lookups | Paid plans only. The automatic lookup after a search keeps running for paid plans but stops at the allowance; "Find email" asks first when none are left. One lookup = one business on which a paid provider credit was spent, however many providers the cascade tried | Free costs nothing to run; the counter matches what the owner pays |
| Email verification (Verifalia) | Paid plans only, one check per email sent | Today's 25 free checks a day are shared by everyone, so they'd run out; the owner buys credits |
| Until launch | Sign-ups stay closed (`SIGNUPS_OPEN=false`; `OWNER_EMAIL` and the `ALLOWED_EMAILS` allowlist can still sign in). Sending email and HubSpot stay owner-only until per-user settings exist | A half-built phase can't spend the owner's credits or send from the owner's mailbox |
| Sending outreach email | Free: "Copy email" and "Open in Gmail/Outlook". Paid: connect your own mailbox (SMTP app password, like the owner's Zoho setup), stored encrypted | Mail comes from the user's own address, so deliverability is theirs |
| HubSpot | Paid: each user pastes their own private-app token, stored encrypted | Today's handoff, per user |
| Whose name is on it **(owner)** | Neutral: a Free user's report and email, and a visitor's free audit, say "Audited with Auditely" and invite the reader to try Auditely. Nothing outside the owner's account mentions DevArtVentures | Auditely stands on its own as a product |
| PDF report branding | Free: Auditely's footer and sign-up invitation. Paid: your name, logo, contact and booking link. The owner's account carries today's DevArtVentures details as its profile | The white-label report is what agencies pay for |
| AI summary and cold email | The prompt takes the user's name and company from their profile (Free and blank profiles: a neutral sign-off). Changing the profile applies to reports written from then on; "Write again" redoes an old one | Today's prompt writes as DevArtVentures for everyone |
| Google place data **(owner)** | Comply: store `place_id` (kept indefinitely); names, phones, websites and ratings are kept 30 days. A saved search older than that shows its businesses' details as expired, with "Refresh this search", which re-runs it, matches by `place_id` and counts as a search. A search is only reused when under 30 days old. Audit results are Auditely's own and are kept | Maps Platform terms; a re-run costs about what one search does, far less than a Place Details call per business |
| Region **(owner)** | United States first: search and city suggestions stay US-only, Stripe Tax for US sales tax, Terms and Privacy written for the US (CCPA included) | Other countries later |
| Domain **(owner)** | Phases 1–4 run on auditely.vercel.app with sign-ups closed. The owner checks the name and buys a domain before the landing page goes public; Google sign-in, the sign-in email sender (custom SMTP in Supabase, since its built-in mailer is rate-limited) and Stripe move to it then | Nothing public waits on the name |
| Secrets at rest | AES-256-GCM with a server key (`SECRETS_KEY`), never sent back to the browser | Mailbox passwords and HubSpot tokens are someone else's keys |
| Visual direction | Minimal, owner's call: white page, the existing ink text and one accent, the product shown rather than described | |

## Plans (proposal)

| | Free | Pro | Agency |
|---|---|---|---|
| Price | $0 | $24/mo | $59/mo |
| Lead searches / month | 1 | 25 | 80 |
| Website audits / month | 5 | 250 | 1,000 |
| Paid email lookups / month | 0 (free site scan only) | 100 | 400 |
| "Audit all" | — | ✓ | ✓ |
| PDF report | Auditely footer | Your branding | Your branding |
| Send from your mailbox | — | ✓ | ✓ |
| HubSpot handoff | — | ✓ | ✓ |
| CSV / Google Sheets export | — | ✓ | ✓ |

Worst-case cost if a user uses everything: Pro ≈ $9–10, Agency ≈ $30–35, before Google's free monthly allowance.
Most users use a fraction. Limits are hard: at the limit the action is refused with "You've used your 25 searches
this month. They reset on Nov 14." and an upgrade link. No overage billing at launch.

## Free audit (landing page, no sign-up)

- The landing page hero has one field: "Paste a website". It runs the real audit and shows the report on the
  page. Saving it, downloading the PDF or auditing another site asks to sign up; signing up keeps the audit.
- **One per visitor.** Three checks, all server-side:
  1. A signed, httpOnly cookie set when the free audit is used.
  2. A `free_audits` row keyed by a salted hash of the IP address, refused for 30 days. The IP itself isn't stored.
  3. A daily cap across all visitors (`FREE_AUDIT_DAILY_CAP`, default 200), so a flood can't run up costs.
- Bots: Vercel BotID on the free-audit route.
- Switches, all Vercel environment variables, changed without a deploy of new code (a redeploy picks them up):
  - `FREE_AUDIT_ENABLED` (on/off): off hides the field and shows "Sign up to audit a website".
  - `FREE_AUDIT_DAILY_CAP`: the daily ceiling.
  - `FREE_AUDIT_WINDOW_DAYS`: how long one visitor waits before another free audit (default 30).
  - `FREE_AUDIT_IP_SALT`: the hash salt (rotate it to reset everyone).
- The owner's admin view lists today's free audits and the count against the cap.

## Landing page (minimal)

One page, five short parts, nothing that doesn't help a visitor decide:

1. **Header:** logo; "Pricing", "Sign in", "Start free".
2. **Hero:** a single-sentence headline, one supporting line, and the free audit field. The product is the hero:
   no illustration.
3. **The report:** a real audit report (the demo's sample) shown as it looks, scores and plain-English findings.
4. **For agencies:** the actual sequence, in three steps: search a city and business type → audit every website
   → send each one its report. A screenshot of the results list, and "See a sample search" (the demo).
5. **Pricing** (the three plans above) and a footer: Terms, Privacy, contact.

Copy, typefaces and layout are worked out with the owner in a mockup before building (see Process).

## App polish

- A usage meter in the header ("3 of 5 audits left this month") and upgrade prompts where a limit stops an action.
- A Settings page: profile and report branding, mailbox, HubSpot, plan and billing (Stripe customer portal).
- First-run states: a new account's empty workspace says what to do first.
- One pass over spacing, type and colour so the app and landing page read as one product.

## Data model

New or changed tables (one migration per phase):

- `profiles` (id = `auth.users.id`, display name, company, logo URL, contact email/phone, booking URL, created_at).
- `subscriptions` (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start/end).
- `usage_events` (user_id, kind: search | audit | email_lookup, created_at): counted for the current period.
- `user_secrets` (user_id, kind: smtp | hubspot, ciphertext, updated_at).
- `free_audits` (ip_hash, business_id, created_at).
- `user_id` added to `searches`, `businesses`, `notifications`; reserved searches (URL audits, requests) become
  per user. "The same search run again reuses this one" becomes per user.
- `pagespeed_cache` stays shared: it holds no user data.

## Phases

Sign-ups stay closed through every phase; opening them is the launch.

1. **Accounts and isolation:** Supabase Auth, sign-in pages, `user_id` + RLS, the owner migration, owner-only
   Requests; sending and HubSpot owner-only. The app works exactly as today for the owner, and an allowlisted
   second account sees an empty, private workspace.
2. **Plans and limits:** usage counting, Free limits, the usage meter and upgrade prompts.
3. **Per-user settings:** profile and report branding (the AI prompt, PDF and outreach email take the user's
   details instead of DevArtVentures'), own mailbox, HubSpot.
4. **Stripe:** Checkout, customer portal, webhook → `subscriptions`; Pro and Agency, monthly and yearly.
5. **Landing page, free audit and polish:** the page, the public free-audit route and its controls, Terms and
   Privacy, the polish pass. Then sign-ups open.

Each phase ships on its own and is reviewed before the next starts.

## Risks and things to settle before launch

- **Vercel Hobby is for non-commercial use.** A paid product needs Vercel Pro ($20/mo). It also fixes the
  collaboration block seen on DevArt's deploys.
- **Supabase free tier** pauses after a week without traffic and has small limits; Pro ($25/mo) before launch.
- **Google Places terms:** handled by the 30-day rule above; the Places attribution ("Google Maps" data notice)
  is shown wherever place data is.
- **Email-finder and verification credits:** today's provider keys are on free tiers (~150 lookups a month in all).
  Paid plans need paid Hunter/Snov (and Verifalia) plans before sign-ups open; the cascade keeps the providers
  the owner buys.
- **Cold email rules** (CAN-SPAM, GDPR, PECR): the Terms make users responsible for what they send; every
  outreach email keeps an opt-out line.
- **Name and domain:** "Auditely" should be checked for trademarks before the domain is bought.

## Process

1. Owner approves this document (and the questions it raises).
2. A plan per phase (superpowers:writing-plans), built and reviewed phase by phase.
3. The landing page starts with a mockup the owner reacts to before it's built.

## Left to the builder

- Library choices within the decisions above (e.g. `@supabase/ssr` for sessions).
- Exact wording of limit messages and empty states, in the app's existing voice.
- How usage is counted (a row per event, or counters), as long as limits are checked before the costly call.
