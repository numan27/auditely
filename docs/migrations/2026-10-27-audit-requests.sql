-- 2026-10-27 audit requests migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- A free audit requested on devartventures.com (the Requests tab):
-- { source_id, name, business_type, main_concern, requested_at }. NULL for
-- leads and sites added by URL.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS request JSONB;

-- The site's id for the request: one sent twice is stored once
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_request_source
  ON businesses ((request->>'source_id')) WHERE request IS NOT NULL;
