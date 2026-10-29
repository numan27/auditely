# Brand studio setup

The Brand studio (`/studio`, "Brand studio" in the header) is where a Pro or Agency
account sets how its reports and emails look: its name, logo and contact details,
the accent and button colours, the typeface, the header style, which sections the
report shows and in what order, their titles and icons, and the wording of the
report's title and its next step. A live preview redraws the sample audit as a PDF
or as the outreach email.

Free accounts, and every account without a paid plan during the beta, see the
studio in a sample look with every field disabled, and a note saying it comes with
Pro and Agency. While `NEXT_PUBLIC_BETA_MODE` is on, the note says paid plans open
after the beta instead of linking to the plans.

## One step: run the migration

Run `docs/migrations/2026-11-02-brand-studio.sql` in Supabase (Dashboard → SQL
Editor → New query, paste, Run). It is safe to run again. It adds
`profiles.brand_design` and lets a signed-in user change it on their own row only.

Until it has run:

- reports and emails keep today's look;
- the studio opens, but the owner sees which migration to run, and anyone else
  reads that their brand can't be saved right now. Save stays off.

## What changed elsewhere

- Settings → Profile and branding now links to the studio; the profile form there
  is commented out (`settingsView.tsx`), since the studio edits the same fields.
- The design reaches every report drawn from now on (the PDF, the private report
  link, the Upwork version without the next step) and every outreach email.
- Characters the PDF's built-in fonts can't draw, like emoji, are left out of the
  design's wording on the PDF.
