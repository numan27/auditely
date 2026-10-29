-- 2026-11-02 Brand studio migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it after docs/migrations/2026-10-29-settings.sql (docs/brand-studio-setup.md). It adds
-- profiles.brand_design, the look each account gives its reports and emails in the
-- Brand studio: colours, typeface, header, sections and wording. It can run before
-- or after the deploy: until it has run, reports keep today's look and the studio
-- says it can't save yet.
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- Stop if profiles has policies other than its own two: Postgres ORs policies
-- together, so another would let one account change another's profile.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname NOT IN ('own_profile','own_profile_update');
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show one account''s rows to another: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- The app checks every field (brandDesign.ts); an object of at most 16 KB is the backstop
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_design JSONB;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_brand_design_shape;
ALTER TABLE profiles ADD CONSTRAINT profiles_brand_design_shape CHECK (
  brand_design IS NULL OR (jsonb_typeof(brand_design) = 'object' AND pg_column_size(brand_design) <= 16384)
);

-- The settings migration's grant, with brand_design added: a signed-in user may
-- change these columns of their own row and nothing else
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, company, website, logo_data_url, contact_email, contact_phone, booking_url, brand_design, updated_at)
  ON profiles TO authenticated;
DROP POLICY IF EXISTS own_profile_update ON profiles;
CREATE POLICY own_profile_update ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

COMMIT;
