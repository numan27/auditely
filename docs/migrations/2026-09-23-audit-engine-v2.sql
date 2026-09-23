-- 2026-09-23 audit engine v2 migration for EXISTING Auditely databases.
-- Run AFTER docs/migrations/2026-09-23-hardening.sql.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

BEGIN;

-- GEO / AEO scores, structured check results and the engine version.
-- Existing rows get engine_version = 1, which the dashboard shows as "Outdated".
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS geo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS aeo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS checks         JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_version INTEGER NOT NULL DEFAULT 1;

-- A metric that couldn't be measured is stored as NULL ("—"), never 0.
ALTER TABLE audits
  ALTER COLUMN performance_score DROP NOT NULL,
  ALTER COLUMN performance_score DROP DEFAULT,
  ALTER COLUMN seo_score         DROP NOT NULL,
  ALTER COLUMN seo_score         DROP DEFAULT,
  ALTER COLUMN mobile_score      DROP NOT NULL,
  ALTER COLUMN mobile_score      DROP DEFAULT,
  ALTER COLUMN ssl_valid         DROP NOT NULL,
  ALTER COLUMN ssl_valid         DROP DEFAULT;

COMMIT;
