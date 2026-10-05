-- 2026-10-02 "Send email" migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE using "Send email".

-- When the outreach email was last sent to a lead, so it isn't sent twice by accident.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
