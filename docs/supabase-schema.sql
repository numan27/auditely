-- Run this in your Supabase project: Dashboard → SQL Editor → New query

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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. audits
CREATE TABLE IF NOT EXISTS audits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  performance_score   INTEGER     NOT NULL DEFAULT 0,
  seo_score           INTEGER     NOT NULL DEFAULT 0,
  mobile_score        INTEGER     NOT NULL DEFAULT 0,
  ssl_valid           BOOLEAN     NOT NULL DEFAULT false,
  raw_json            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ai_reports
CREATE TABLE IF NOT EXISTS ai_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  summary      TEXT        NOT NULL DEFAULT '',
  improvements JSONB       NOT NULL DEFAULT '[]',
  cold_email   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_businesses_search_id  ON businesses(search_id);
CREATE INDEX IF NOT EXISTS idx_audits_business_id    ON audits(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_audit_id   ON ai_reports(audit_id);
CREATE INDEX IF NOT EXISTS idx_searches_niche_loc    ON searches(niche, location, created_at);
