-- 2026-10-28 accounts migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- 1. Replace the address: the account that keeps today's data (OWNER_EMAIL). Create it first (docs/accounts-setup.md).
DO $$ BEGIN PERFORM set_config('auditely.owner_email', lower(trim('owner@example.com')), false); END $$;

-- Run docs/migrations/2026-10-27-audit-requests.sql and 2026-10-27-notifications.sql
-- first: this one changes notifications and businesses. Run it straight before
-- deploying the accounts code (docs/accounts-setup.md): once it has run, a new row
-- takes its user_id from the signed-in session, so the old code can't save one.
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- First, stop if these tables have policies of their own (a dashboard template such
-- as "Enable read access for all users"). Postgres ORs policies together, so any
-- other policy would let one account's rows through to another, whatever own_rows says.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('profiles','searches','businesses','audits','ai_reports','notifications','pagespeed_cache')
    AND policyname NOT IN ('own_rows','own_profile');
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show one account''s rows to another: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- profiles: one per account, added when the account is created. The server finds
-- the owner's id here by email (ownerUserId); a signed-in user reads only their own.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.profiles (id, email) VALUES (NEW.id, lower(NEW.email)) ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Accounts created before this migration, the owner's among them
INSERT INTO profiles (id, email) SELECT id, lower(email) FROM auth.users WHERE email IS NOT NULL ON CONFLICT (id) DO NOTHING;

-- 2. Every user-owned row says whose it is; today's rows are the owner's
DO $$
DECLARE owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE lower(email) = current_setting('auditely.owner_email');
  IF owner_id IS NULL THEN RAISE EXCEPTION 'No account for %: create it in Authentication → Users first', current_setting('auditely.owner_email'); END IF;
  ALTER TABLE searches      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE businesses    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE searches      SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE businesses    SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE notifications SET user_id = owner_id WHERE user_id IS NULL;
END $$;
-- A row a signed-in user adds is theirs: auth.uid() is the session's user id. The
-- service role has no user, so the server sets user_id itself (the inbound route).
ALTER TABLE searches      ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE businesses    ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_searches_user      ON searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_user    ON businesses (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- 3. Each signed-in user reaches only their own rows. pagespeed_cache keeps no policy: server only.
--    RLS is switched on again for every table (already on since the hardening
--    migration): a table without it would ignore its policies and show everyone's rows.
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE searches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagespeed_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_profile ON profiles;
CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON searches;
CREATE POLICY own_rows ON searches FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON businesses;
CREATE POLICY own_rows ON businesses FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON notifications;
CREATE POLICY own_rows ON notifications FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- An audit, and its AI report, belong to whoever owns the business
DROP POLICY IF EXISTS own_rows ON audits;
CREATE POLICY own_rows ON audits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = audits.business_id AND b.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = audits.business_id AND b.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS own_rows ON ai_reports;
CREATE POLICY own_rows ON ai_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM audits a JOIN businesses b ON b.id = a.business_id
                 WHERE a.id = ai_reports.audit_id AND b.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM audits a JOIN businesses b ON b.id = a.business_id
                      WHERE a.id = ai_reports.audit_id AND b.user_id = (SELECT auth.uid())));

-- The signed-in role may use these tables at all; the policies above pick the rows.
-- Supabase usually grants this already. Nothing is granted to anon, which has no policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON searches, businesses, audits, ai_reports, notifications TO authenticated;
GRANT SELECT ON profiles TO authenticated;
-- The server's owner lookup (ownerUserId) reads profiles with the service role key
GRANT SELECT ON profiles TO service_role;

COMMIT;
