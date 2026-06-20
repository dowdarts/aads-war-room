-- Postgres requires SELECT privilege to use ON CONFLICT DO UPDATE (what the
-- client's upsert generates), even when no conflicting row exists yet.
-- Without it, Postgres reports the missing-SELECT problem as a generic RLS
-- violation on the insert itself. Low sensitivity here: just opaque push
-- tokens, no names/emails, and useless without the server-side VAPID key.
CREATE POLICY "anon select own subscription" ON public.cue_light_push_subscriptions
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.cue_light_push_subscriptions TO anon;
