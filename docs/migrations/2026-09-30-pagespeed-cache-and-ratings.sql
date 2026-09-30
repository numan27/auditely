-- 2026-09-30 PageSpeed cache + Google ratings migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE deploying the matching code: new searches store the rating columns.

BEGIN;

-- Google rating and review count for each business found by a search.
-- NULL = unknown (found before this migration, or added by URL).
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS rating       NUMERIC(2, 1),
  ADD COLUMN IF NOT EXISTS review_count INTEGER;

-- PageSpeed results shared by every listing of the same website for 30 days,
-- keyed by the website without scheme / "www." / trailing slash (websiteKey()).
CREATE TABLE IF NOT EXISTS pagespeed_cache (
  url_key        TEXT        NOT NULL,
  strategy       TEXT        NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  summary        JSONB       NOT NULL,
  is_on_https    BOOLEAN,
  engine_version INTEGER     NOT NULL,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url_key, strategy)
);

-- Same as the other tables: RLS on, no policies (the service-role key bypasses it)
ALTER TABLE pagespeed_cache ENABLE ROW LEVEL SECURITY;

COMMIT;
