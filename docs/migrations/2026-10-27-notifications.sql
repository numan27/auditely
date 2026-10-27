-- 2026-10-27 notifications migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- The header bell (lib/notifications): new audit requests, replies due or
-- overdue, a request's audit finished or failed, and "Audit all" runs. A
-- request's notifications go when the request is removed. dedupe_key makes the
-- same event one notification (a request resent, a due reminder seen twice).
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  business_id UUID        REFERENCES businesses(id) ON DELETE CASCADE,
  search_id   UUID        REFERENCES searches(id) ON DELETE CASCADE,
  dedupe_key  TEXT        UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

-- On, with no policies, like the other tables: only the app's server (service role) reads it
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
