-- 2026-11-01 place data migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Google's terms let Auditely keep a place's id for good but its other details (name, address,
-- website, phone, rating) for 30 days (docs/place-data-setup.md). This adds the column each
-- business keeps Google's place id in, so a search run again after 30 days updates the
-- businesses it had, and each keeps its audit. Until it has run, businesses are saved without
-- the id and matched by their website, or by name and address.
-- Run it before turning on PLACE_DATA_ERASE: a blanked business can only be matched by its id.
-- It runs as one transaction: an error changes nothing.

BEGIN;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS place_id TEXT;

-- A refresh reads a search's businesses by their place id
CREATE INDEX IF NOT EXISTS idx_businesses_search_place ON businesses (search_id, place_id);

COMMIT;

-- So the API sees the new column straight away
NOTIFY pgrst, 'reload schema';
