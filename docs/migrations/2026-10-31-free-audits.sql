-- 2026-10-31 free audits migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it before turning on FREE_AUDIT_ENABLED (docs/launch-setup.md). It adds the table the
-- landing page's free audits are kept in, and the function that hands them out: one per
-- visitor's network in the window, up to a daily cap. Until it has run, the free audit
-- answers "Free audits aren't available right now".
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- First, stop if free_audits has any policy (a dashboard template such as "Enable read
-- access for all users"). No account may read this table: it holds every visitor's audit.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'free_audits';
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show free audits to an account: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- One row per free audit: 'running' while it's being made, 'done' with its results.
-- ip_hash is a salted hash of the visitor's network, never the address itself.
-- claimed_by is the account that signed up and kept it.
CREATE TABLE IF NOT EXISTS free_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  website TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done')),
  audit JSONB,
  report JSONB,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS free_audits_ip_hash_created ON free_audits (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS free_audits_created ON free_audits (created_at DESC);
-- RLS on with no policies, and no grants: Supabase grants new tables to anon and
-- authenticated by default. Only the server's service role reads or writes.
ALTER TABLE free_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON free_audits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON free_audits TO service_role;

-- A free audit for this visitor's network, unless it had one since p_since or the day
-- (from p_day_start) has p_daily_cap already. The lock makes count-then-insert atomic,
-- so a burst of requests can't all see room. It clears what's done with first: rows older
-- than both the window and 90 days, and running claims a crashed request left.
-- Returns (id, NULL), or (NULL, 'visitor' | 'cap').
CREATE OR REPLACE FUNCTION public.claim_free_audit(
  p_ip_hash TEXT, p_website TEXT, p_since TIMESTAMPTZ, p_day_start TIMESTAMPTZ, p_daily_cap INT
) RETURNS TABLE (id UUID, refused TEXT) LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE claimed UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('free_audits'));
  DELETE FROM public.free_audits f WHERE f.created_at < LEAST(p_since, NOW() - INTERVAL '90 days');
  DELETE FROM public.free_audits f WHERE f.status = 'running' AND f.created_at < NOW() - INTERVAL '10 minutes';
  IF EXISTS (SELECT 1 FROM public.free_audits f WHERE f.ip_hash = p_ip_hash AND f.created_at >= p_since) THEN
    RETURN QUERY SELECT NULL::UUID, 'visitor'::TEXT;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.free_audits f WHERE f.created_at >= p_day_start) >= p_daily_cap THEN
    RETURN QUERY SELECT NULL::UUID, 'cap'::TEXT;
    RETURN;
  END IF;
  INSERT INTO public.free_audits (ip_hash, website) VALUES (p_ip_hash, p_website) RETURNING free_audits.id INTO claimed;
  RETURN QUERY SELECT claimed, NULL::TEXT;
END $$;
REVOKE ALL ON FUNCTION public.claim_free_audit(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_audit(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO service_role;

COMMIT;
