-- 2026-09-25 contact channels migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- Other ways to reach a business, found on its homepage alongside the email.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS contact_page        TEXT,
  ADD COLUMN IF NOT EXISTS socials             JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contacts_checked_at TIMESTAMPTZ;
