-- AADS Event Chat — Web Push subscriptions for new chat messages.
-- Keyed to staff_accounts.id, which every claimed account (staff, player,
-- or scorekeeper) already has via the sync_account_create() unify trigger,
-- so this one table covers push for the chat regardless of which portal
-- someone signed in through. Mirrors player_portal_push_subscriptions.

CREATE TABLE IF NOT EXISTS public.staff_chat_push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_chat_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert subscription" ON public.staff_chat_push_subscriptions;
CREATE POLICY "anon insert subscription" ON public.staff_chat_push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon upsert subscription" ON public.staff_chat_push_subscriptions;
CREATE POLICY "anon upsert subscription" ON public.staff_chat_push_subscriptions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete own subscription" ON public.staff_chat_push_subscriptions;
CREATE POLICY "anon delete own subscription" ON public.staff_chat_push_subscriptions
  FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "anon select own subscription" ON public.staff_chat_push_subscriptions;
CREATE POLICY "anon select own subscription" ON public.staff_chat_push_subscriptions
  FOR SELECT TO anon USING (true);

GRANT INSERT, UPDATE, DELETE, SELECT ON public.staff_chat_push_subscriptions TO anon;

NOTIFY pgrst, 'reload schema';
