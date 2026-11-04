-- 2026-11-04 place type migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Keeps Google's main type for each business in words ("Marketing agency", "Employment agency",
-- "Dentist"), so the results can be filtered by type and poor matches hidden. It's Google place
-- data, so like the name and address it's blanked after 30 days (docs/place-data-setup.md).
-- Until it has run, searches still work and businesses are saved without their type.
-- It runs as one transaction: an error changes nothing.

BEGIN;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS place_type TEXT;

COMMIT;

-- So the API sees the new column straight away
NOTIFY pgrst, 'reload schema';
