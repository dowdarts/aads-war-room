-- ═══════════════════════════════════════════════════════════════════
-- AADS Players Portal — accounts + Web Push subscriptions
-- Run once in the Supabase SQL Editor
--
-- player_portal_accounts: one row per player, name+PIN login (same
-- trust model as staff_accounts — anon key + permissive RLS, no real
-- Supabase Auth anywhere in this project).
--
-- player_portal_push_subscriptions: like cue_light_push_subscriptions,
-- but tied to a specific player_id so the send-players-portal-push
-- Edge Function can target individuals instead of broadcasting to
-- every subscribed device.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.player_portal_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text UNIQUE NOT NULL,
  pin          text NOT NULL,
  notify_all   boolean NOT NULL DEFAULT false, -- test/admin accounts: get every push regardless of name match
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

ALTER TABLE public.player_portal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert account" ON public.player_portal_accounts;
CREATE POLICY "anon insert account" ON public.player_portal_accounts
  FOR INSERT TO anon WITH CHECK (true);

-- Needed for: the "does this name already have an account?" check during
-- signup, and the PIN comparison during login.
DROP POLICY IF EXISTS "anon select account" ON public.player_portal_accounts;
CREATE POLICY "anon select account" ON public.player_portal_accounts
  FOR SELECT TO anon USING (true);

-- Needed for: updating last_seen_at on login.
DROP POLICY IF EXISTS "anon update account" ON public.player_portal_accounts;
CREATE POLICY "anon update account" ON public.player_portal_accounts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

GRANT INSERT, SELECT, UPDATE ON public.player_portal_accounts TO anon;

CREATE TABLE IF NOT EXISTS public.player_portal_push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.player_portal_accounts(id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert subscription" ON public.player_portal_push_subscriptions;
CREATE POLICY "anon insert subscription" ON public.player_portal_push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon upsert subscription" ON public.player_portal_push_subscriptions;
CREATE POLICY "anon upsert subscription" ON public.player_portal_push_subscriptions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete own subscription" ON public.player_portal_push_subscriptions;
CREATE POLICY "anon delete own subscription" ON public.player_portal_push_subscriptions
  FOR DELETE TO anon USING (true);

-- Required even though anon never explicitly SELECTs: Postgres requires
-- SELECT privilege to use ON CONFLICT DO UPDATE (what the client's
-- upsert-on-endpoint generates) — see cue-light-push-migration.sql for
-- the same rationale.
DROP POLICY IF EXISTS "anon select own subscription" ON public.player_portal_push_subscriptions;
CREATE POLICY "anon select own subscription" ON public.player_portal_push_subscriptions
  FOR SELECT TO anon USING (true);

GRANT INSERT, UPDATE, DELETE, SELECT ON public.player_portal_push_subscriptions TO anon;
