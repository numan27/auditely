-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- (Existing databases: run the files in docs/migrations/ in date/name order instead.)

-- Every user-owned row (searches, businesses, notifications) has a user_id. A row a
-- signed-in user adds is theirs: the default auth.uid() is the session's user id.
-- The service role has no user, so the server sets user_id itself (the inbound route).

-- 1. searches
CREATE TABLE IF NOT EXISTS searches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  niche       TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. businesses
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  search_id   UUID        NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  address     TEXT        NOT NULL DEFAULT '',
  website     TEXT,
  phone       TEXT,
  email       TEXT,
  -- Other ways to reach the business, found on its homepage
  contact_page        TEXT,
  socials             JSONB       NOT NULL DEFAULT '{}',
  contacts_checked_at TIMESTAMPTZ,
  -- When the paid email APIs were tried (once automatically, or via "Find email")
  email_lookup_at     TIMESTAMPTZ,
  -- Google rating and review count (NULL = unknown)
  rating              NUMERIC(2, 1),
  review_count        INTEGER,
  -- The HubSpot company this lead was sent to, and when
  hubspot_company_id  TEXT,
  crm_sent_at         TIMESTAMPTZ,
  -- When the outreach email was last sent from Auditely
  emailed_at          TIMESTAMPTZ,
  -- What Verifalia said about the email address: { address, verdict, status, checked_at }
  email_check         JSONB,
  -- A free audit requested on devartventures.com (the Requests tab):
  -- { source_id, name, business_type, main_concern, requested_at }; NULL otherwise
  request             JSONB,
  -- Google's place id, kept for good as Google allows; its other details are kept 30 days
  -- (docs/place-data-setup.md), and a search run again after that matches its rows by this id
  place_id            TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. audits (one per business). NULL score = not measured, never 0.
CREATE TABLE IF NOT EXISTS audits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  performance_score   INTEGER,
  seo_score           INTEGER,
  mobile_score        INTEGER,
  ssl_valid           BOOLEAN,
  geo_score           INTEGER,
  aeo_score           INTEGER,
  lead_score          INTEGER,
  checks              JSONB       NOT NULL DEFAULT '{}',
  engine_version      INTEGER     NOT NULL DEFAULT 1,
  raw_json            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ai_reports (one per audit)
CREATE TABLE IF NOT EXISTS ai_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID        NOT NULL UNIQUE REFERENCES audits(id) ON DELETE CASCADE,
  summary      TEXT        NOT NULL DEFAULT '',
  improvements JSONB       NOT NULL DEFAULT '[]',
  cold_email   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. pagespeed_cache: PageSpeed results shared by every listing of the same
--    website for 30 days, keyed by websiteKey() (no scheme / "www." / trailing slash)
CREATE TABLE IF NOT EXISTS pagespeed_cache (
  url_key        TEXT        NOT NULL,
  strategy       TEXT        NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  summary        JSONB       NOT NULL,
  is_on_https    BOOLEAN,
  engine_version INTEGER     NOT NULL,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url_key, strategy)
);

-- 6. notifications: the header bell (lib/notifications). dedupe_key makes the
--    same event one notification (a request resent, a due reminder seen twice).
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  business_id UUID        REFERENCES businesses(id) ON DELETE CASCADE,
  search_id   UUID        REFERENCES searches(id) ON DELETE CASCADE,
  dedupe_key  TEXT        UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

-- 7. profiles: one per account, added when the account is created. The server
--    finds the owner's id here by email (ownerUserId); a signed-in user reads only their own.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Who the account's reports and emails come from (Settings). All optional; the
  -- logo is a PNG or JPEG of at most 256 KB, kept as a data URL.
  display_name  TEXT,
  company       TEXT,
  website       TEXT,
  logo_data_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  booking_url   TEXT,
  -- The look the account gives its reports and emails in the Brand studio (brandDesign.ts)
  brand_design  JSONB,
  updated_at    TIMESTAMPTZ,
  CONSTRAINT profiles_settings_length CHECK (
    char_length(display_name) <= 200 AND char_length(company) <= 200 AND char_length(website) <= 200
    AND char_length(contact_email) <= 200 AND char_length(contact_phone) <= 200 AND char_length(booking_url) <= 200
    AND char_length(logo_data_url) <= 350000
  ),
  CONSTRAINT profiles_brand_design_shape CHECK (
    brand_design IS NULL OR (jsonb_typeof(brand_design) = 'object' AND pg_column_size(brand_design) <= 16384)
  )
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
-- Accounts created before this file was run
INSERT INTO profiles (id, email) SELECT id, lower(email) FROM auth.users WHERE email IS NOT NULL ON CONFLICT (id) DO NOTHING;

-- Indexes for common lookups (audits/ai_reports are covered by their UNIQUE indexes)
CREATE INDEX IF NOT EXISTS idx_businesses_search_id  ON businesses(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_niche_loc    ON searches(niche, location, created_at);
-- The site's id for an audit request: one sent twice is stored once
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_request_source
  ON businesses ((request->>'source_id')) WHERE request IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_searches_user         ON searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_user       ON businesses (user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_search_place ON businesses (search_id, place_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications (user_id, created_at DESC);

-- Row Level Security: each signed-in user reaches only their own rows. The app's
-- API routes use SUPABASE_ANON_KEY with the user's session (role authenticated,
-- auth.uid() = their id). An audit, and its AI report, belong to whoever owns the
-- business. anon has no policy, so it reads/writes nothing. The service role key
-- (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS; the server uses it only for the shared
-- pagespeed_cache (no policy: server only), the devartventures.com inbound route,
-- signed report links, the owner lookup, the brand lookup, the usage ledger and
-- the saved secrets below.
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE searches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagespeed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_profile ON profiles;
CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_profile_update ON profiles;
CREATE POLICY own_profile_update ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON searches;
CREATE POLICY own_rows ON searches FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON businesses;
CREATE POLICY own_rows ON businesses FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS own_rows ON notifications;
CREATE POLICY own_rows ON notifications FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
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
-- Supabase usually grants this already. Nothing is granted to anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON searches, businesses, audits, ai_reports, notifications TO authenticated;
GRANT SELECT ON profiles TO authenticated;
-- A signed-in user may change their own profile's Settings fields and nothing else:
-- the email, which decides who the owner is, and the id stay as sign-up set them.
-- Supabase grants new tables to anon and authenticated by default, so that goes first.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, company, website, logo_data_url, contact_email, contact_phone, booking_url, brand_design, updated_at)
  ON profiles TO authenticated;
-- The server's owner lookup (ownerUserId) and the brand lookup (brand.ts) read
-- profiles with the service role key
GRANT SELECT ON profiles TO service_role;

-- 8. usage_events: one row per search, audit or email lookup an account has used,
--    counted against its plan's monthly allowance. A user may read their own rows
--    (the meter) and never write one: only the server's service role writes, through
--    claim_usage.
CREATE TABLE IF NOT EXISTS usage_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('search', 'audit', 'email_lookup')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events (user_id, kind, created_at DESC);
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_rows ON usage_events;
CREATE POLICY own_rows ON usage_events FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Supabase grants new tables to anon and authenticated by default
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

-- 9. user_secrets: an account's saved mailbox password and HubSpot token, encrypted
--    by the server (SECRETS_KEY) before they get here. The label (the mailbox
--    address) is plain, so Settings can say what's connected without decrypting.
--    No policies and no grants to signed-in users: only the service role reads it.
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

-- 10. subscriptions: each account's latest Stripe subscription, which sets its plan.
--     The webhook copies it from Stripe. period_anchor is Stripe's billing cycle
--     anchor, which the monthly allowances count from. A user may read their own row
--     and never write one: only the server's service role writes.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    TEXT        NOT NULL CHECK (plan IN ('pro', 'agency')),
  billing_interval        TEXT        NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status                  TEXT        NOT NULL,
  stripe_customer_id      TEXT        NOT NULL UNIQUE,
  stripe_subscription_id  TEXT        NOT NULL UNIQUE,
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  period_anchor           TIMESTAMPTZ NOT NULL,
  ends_at                 TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_subscription ON subscriptions;
CREATE POLICY own_subscription ON subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Supabase grants new tables to anon and authenticated by default
REVOKE ALL ON subscriptions FROM anon, authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO service_role;

-- 11. free_audits: the landing page's free audits, one per visitor's network in the
--     window and up to a daily cap. ip_hash is a salted hash of the visitor's network,
--     never the address. claimed_by is the account that signed up and kept it. No
--     account may read the table: only the server's service role reads or writes, and
--     claim_free_audit hands audits out under one lock.
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
