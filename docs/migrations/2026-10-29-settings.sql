-- 2026-10-29 settings migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it after docs/migrations/2026-10-28-usage.sql (docs/settings-setup.md). It adds the
-- profile each account's reports and emails are signed with, and the table its saved
-- mailbox password and HubSpot token are kept in, encrypted. It can run before the
-- deploy: today's code ignores the new columns and table.
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- First, stop if user_secrets has any policy at all (a dashboard template such as
-- "Enable read access for all users"): only the server reads it, so any policy would
-- hand a signed-in user someone's saved password. Then stop if profiles has policies
-- other than its own two: Postgres ORs policies together, so another would let one
-- account change another's profile.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I', policyname), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_secrets';
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Policies on user_secrets would let a signed-in user read saved passwords: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname NOT IN ('own_profile','own_profile_update');
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show one account''s rows to another: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- profiles: who an account's reports and emails come from. Every field is optional;
-- the app checks each one (profileInput.ts) and these lengths are a backstop. The
-- logo is a PNG or JPEG of at most 256 KB, kept as a data URL.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS company       TEXT,
  ADD COLUMN IF NOT EXISTS website       TEXT,
  ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS booking_url   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_settings_length;
ALTER TABLE profiles ADD CONSTRAINT profiles_settings_length CHECK (
  char_length(display_name) <= 200 AND char_length(company) <= 200 AND char_length(website) <= 200
  AND char_length(contact_email) <= 200 AND char_length(contact_phone) <= 200 AND char_length(booking_url) <= 200
  AND char_length(logo_data_url) <= 350000
);
-- A signed-in user may change these columns of their own row and nothing else: the
-- email, which decides who the owner is, and the id stay as sign-up set them.
-- Supabase grants new tables to anon and authenticated by default, and a grant on
-- the whole table would cover the email too, so that goes first.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, company, website, logo_data_url, contact_email, contact_phone, booking_url, updated_at)
  ON profiles TO authenticated;
DROP POLICY IF EXISTS own_profile_update ON profiles;
CREATE POLICY own_profile_update ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- user_secrets: an account's saved mailbox password and HubSpot token, encrypted by
-- the server (SECRETS_KEY) before they get here. The label (the mailbox address) is
-- plain, so Settings can say what's connected without decrypting anything. No
-- policies and no grants to signed-in users: only the server's service role reads it.
CREATE TABLE IF NOT EXISTS user_secrets (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('smtp', 'hubspot')),
  ciphertext  TEXT        NOT NULL,
  label       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_secrets TO service_role;

COMMIT;
