-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- (Existing databases: run the files in docs/migrations/ in date/name order instead.)

-- 1. searches
CREATE TABLE IF NOT EXISTS searches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  niche       TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. businesses
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes for common lookups (audits/ai_reports are covered by their UNIQUE indexes)
CREATE INDEX IF NOT EXISTS idx_businesses_search_id  ON businesses(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_niche_loc    ON searches(niche, location, created_at);

-- Row Level Security: on, with no policies. The public anon key can read/write
-- nothing; the app's server uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
ALTER TABLE searches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagespeed_cache ENABLE ROW LEVEL SECURITY;
