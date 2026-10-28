-- 2026-10-30 subscriptions migration for EXISTING Auditely databases. Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it after docs/migrations/2026-10-29-settings.sql (docs/billing-setup.md). It adds the
-- table each account's Stripe subscription is kept in, which sets its plan. Until it has
-- run, every account reads as having no subscription: Free, or its PLAN_OVERRIDES plan.
-- It runs as one transaction: an error changes nothing.

BEGIN;

-- First, stop if subscriptions has policies of its own (a dashboard template such as
-- "Enable read access for all users"). Postgres ORs policies together, so any other
-- policy would show one account's billing to another, whatever own_subscription says.
DO $$
DECLARE stray text;
BEGIN
  SELECT string_agg(format('%I on %I', policyname, tablename), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname <> 'own_subscription';
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Other policies would show one account''s rows to another: %. Drop them (Authentication → Policies), then run this again.', stray;
  END IF;
END $$;

-- One row per account: its latest Stripe subscription, copied from Stripe by the
-- webhook. period_anchor is Stripe's billing cycle anchor, which the monthly
-- allowances count from; ends_at is set once a cancelled subscription has a stop date.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'agency')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  period_anchor TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_subscription ON subscriptions;
CREATE POLICY own_subscription ON subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Supabase grants new tables to anon and authenticated by default: a user may read
-- their own row (their plan) and never write one, so nobody can grant themselves a
-- plan. Only the server's service role writes, from what Stripe says.
REVOKE ALL ON subscriptions FROM anon, authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO service_role;

COMMIT;
