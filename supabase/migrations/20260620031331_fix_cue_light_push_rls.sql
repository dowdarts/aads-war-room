-- Re-create RLS policies for cue_light_push_subscriptions (idempotent).
-- A 401/42501 on INSERT from the anon key indicates these never took
-- effect from the earlier manual SQL Editor run.
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

GRANT INSERT, UPDATE, DELETE ON public.cue_light_push_subscriptions TO anon;
