-- 2026-09-30 lead capture migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE deploying the matching code: every new audit writes lead_score.

-- 0–100: can visitors call, message or book? NULL = not measured (older audits,
-- blocked or JavaScript-only sites).
ALTER TABLE audits ADD COLUMN IF NOT EXISTS lead_score INTEGER;
