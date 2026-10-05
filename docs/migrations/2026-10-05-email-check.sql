-- 2026-10-05 email check migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- What Verifalia said about the lead's email address before it was emailed:
-- { address, verdict, status, checked_at }. Reused while fresh, so reopening
-- "Send email" doesn't spend another of the day's free checks.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_check JSONB;
