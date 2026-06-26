-- AADS Score Keepers Portal — accounts + Web Push subscriptions.
-- Mirrors 20260620120000_create_players_portal.sql, same trust model:
-- self-serve name+PIN accounts, anon RLS, no separate password flow.

CREATE TABLE IF NOT EXISTS public.scorekeeper_portal_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text UNIQUE NOT NULL,
  pin          text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

ALTER TABLE public.scorekeeper_portal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert account" ON public.scorekeeper_portal_accounts;
CREATE POLICY "anon insert account" ON public.scorekeeper_portal_accounts
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon select account" ON public.scorekeeper_portal_accounts;
CREATE POLICY "anon select account" ON public.scorekeeper_portal_accounts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon update account" ON public.scorekeeper_portal_accounts;
CREATE POLICY "anon update account" ON public.scorekeeper_portal_accounts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

GRANT INSERT, SELECT, UPDATE ON public.scorekeeper_portal_accounts TO anon;

CREATE TABLE IF NOT EXISTS public.scorekeeper_portal_push_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorekeeper_id uuid NOT NULL REFERENCES public.scorekeeper_portal_accounts(id) ON DELETE CASCADE,
  endpoint       text UNIQUE NOT NULL,
  p256dh         text NOT NULL,
  auth           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scorekeeper_portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert subscription" ON public.scorekeeper_portal_push_subscriptions;
CREATE POLICY "anon insert subscription" ON public.scorekeeper_portal_push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon upsert subscription" ON public.scorekeeper_portal_push_subscriptions;
CREATE POLICY "anon upsert subscription" ON public.scorekeeper_portal_push_subscriptions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete own subscription" ON public.scorekeeper_portal_push_subscriptions;
CREATE POLICY "anon delete own subscription" ON public.scorekeeper_portal_push_subscriptions
  FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "anon select own subscription" ON public.scorekeeper_portal_push_subscriptions;
CREATE POLICY "anon select own subscription" ON public.scorekeeper_portal_push_subscriptions
  FOR SELECT TO anon USING (true);

GRANT INSERT, UPDATE, DELETE, SELECT ON public.scorekeeper_portal_push_subscriptions TO anon;

NOTIFY pgrst, 'reload schema';
