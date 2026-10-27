-- 2026-10-28 usage migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it after docs/migrations/2026-10-28-accounts.sql (docs/plans-setup.md). It adds the
-- ledger each account's monthly searches, audits and email lookups are counted in. Until
-- it has run, accounts other than the owner's get "Couldn't check this month's allowance".
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- First, stop if usage_events has policies of its own (a dashboard template such as
-- "Enable read access for all users"). Postgres ORs policies together, so any other
-- policy would let one account's rows through to another, whatever own_rows says.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'usage_events' AND policyname <> 'own_rows';
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show one account''s rows to another: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- One row per search, audit or email lookup an account has used
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('search', 'audit', 'email_lookup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events (user_id, kind, created_at DESC);
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_rows ON usage_events;
CREATE POLICY own_rows ON usage_events FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Supabase grants new tables to anon and authenticated by default: a user may read
-- their own rows (the meter) and never write one. Only the server's service role writes.
REVOKE ALL ON usage_events FROM anon, authenticated;
GRANT SELECT ON usage_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON usage_events TO service_role;

-- One use of `kind`, recorded only while the account is under its limit for the period.
-- The lock makes count-then-insert atomic per account and kind, so ten requests at
-- once can't all see room for one. Returns the new row's id, or NULL at the limit.
CREATE OR REPLACE FUNCTION public.claim_usage(p_user_id UUID, p_kind TEXT, p_limit INTEGER, p_since TIMESTAMPTZ)
  RETURNS UUID LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE claimed UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_kind));
  IF (SELECT count(*) FROM public.usage_events
      WHERE user_id = p_user_id AND kind = p_kind AND created_at >= p_since) >= p_limit THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.usage_events (user_id, kind) VALUES (p_user_id, p_kind) RETURNING id INTO claimed;
  RETURN claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_usage(UUID, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_usage(UUID, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;

COMMIT;
