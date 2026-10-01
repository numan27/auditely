-- 2026-10-01 HubSpot hand-off migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE using "Send to HubSpot".

-- The HubSpot company a lead was sent to (so re-sending updates it), and when.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_sent_at        TIMESTAMPTZ;
