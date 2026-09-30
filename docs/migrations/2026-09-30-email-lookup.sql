-- 2026-09-30 email lookup migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- When the paid email APIs were tried for a business (automatically once after
-- a search, or via "Find email"), so the automatic pass never repeats it.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_lookup_at TIMESTAMPTZ;
