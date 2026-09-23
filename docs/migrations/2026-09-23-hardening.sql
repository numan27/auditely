-- 2026-09-23 hardening migration for EXISTING Auditely databases.
-- Run in Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
--
-- BEFORE running: set SUPABASE_SERVICE_ROLE_KEY for the app (locally and on
-- Vercel). Step 4 enables Row Level Security with no policies, which blocks the
-- anon key — an app still on SUPABASE_ANON_KEY will stop working.

BEGIN;

-- 1. businesses.email (used by the email finder; missing from the original schema)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email TEXT;

-- 2a. Duplicate audits per business: keep the newest audit that has an AI report,
--     otherwise the newest audit. Deleting an audit cascades to its ai_reports.
WITH ranked AS (
  SELECT a.id,
         ROW_NUMBER() OVER (
           PARTITION BY a.business_id
           ORDER BY EXISTS (SELECT 1 FROM ai_reports r WHERE r.audit_id = a.id) DESC,
                    a.created_at DESC,
                    a.id DESC
         ) AS rn
  FROM audits a
)
DELETE FROM audits WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2b. Duplicate ai_reports per audit: keep the newest
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY audit_id ORDER BY created_at DESC, id DESC) AS rn
  FROM ai_reports
)
DELETE FROM ai_reports WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. One audit per business, one report per audit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audits_business_id_key') THEN
    ALTER TABLE audits ADD CONSTRAINT audits_business_id_key UNIQUE (business_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_reports_audit_id_key') THEN
    ALTER TABLE ai_reports ADD CONSTRAINT ai_reports_audit_id_key UNIQUE (audit_id);
  END IF;
END $$;

-- The old non-unique indexes are redundant with the UNIQUE indexes
DROP INDEX IF EXISTS idx_audits_business_id;
DROP INDEX IF EXISTS idx_ai_reports_audit_id;

-- 4. Row Level Security: on, no policies (service-role key bypasses RLS)
ALTER TABLE searches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 5. OPTIONAL — legacy audits. Before this fix PageSpeed was called without
--    `category=` params, so only Performance ran: every stored audit has
--    seo_score = 0 and ssl_valid = false. Deleting them (their ai_reports
--    cascade) lets the next "Run Audit" re-audit with correct scores.
--    Uncomment to run:
--
-- DELETE FROM audits WHERE NOT (raw_json->'mobile'->'categories' ? 'seo');
