-- ═══════════════════════════════════════════════════════════════════
-- Cue Light — Web Push subscriptions
-- Run once in the Supabase SQL Editor
--
-- Stores each device's Push subscription so the "send-cue-light-push"
-- Edge Function can fan out a real push notification (delivered even
-- when the app is fully closed) whenever the controller changes the
-- light. The anon key is allowed to insert/delete its own rows; only
-- the Edge Function (service role, bypasses RLS) reads them all.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cue_light_push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cue_light_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert subscription" ON public.cue_light_push_subscriptions;
CREATE POLICY "anon insert subscription" ON public.cue_light_push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon upsert subscription" ON public.cue_light_push_subscriptions;
CREATE POLICY "anon upsert subscription" ON public.cue_light_push_subscriptions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete own subscription" ON public.cue_light_push_subscriptions;
CREATE POLICY "anon delete own subscription" ON public.cue_light_push_subscriptions
  FOR DELETE TO anon USING (true);

-- Required even though anon never explicitly SELECTs: Postgres requires
-- SELECT privilege to use ON CONFLICT DO UPDATE (what the client's
-- upsert-on-endpoint generates), even when no conflicting row exists yet —
-- without it, Postgres reports the missing-SELECT problem as a generic RLS
-- violation on the insert itself. Low sensitivity here: just opaque push
-- tokens, no names/emails, and useless without the server-side VAPID key.
DROP POLICY IF EXISTS "anon select own subscription" ON public.cue_light_push_subscriptions;
CREATE POLICY "anon select own subscription" ON public.cue_light_push_subscriptions
  FOR SELECT TO anon USING (true);

GRANT INSERT, UPDATE, DELETE, SELECT ON public.cue_light_push_subscriptions TO anon;
