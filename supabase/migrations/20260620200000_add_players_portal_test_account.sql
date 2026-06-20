-- Lets one player_portal_accounts row opt into receiving every push the
-- Players Portal sends (doors open, called, live/up-next) regardless of
-- whether their name appears in the schedule — so Matthew has a single
-- test device to verify alerts fire at each step without needing a real
-- player's phone.

ALTER TABLE public.player_portal_accounts
  ADD COLUMN IF NOT EXISTS notify_all boolean NOT NULL DEFAULT false;

INSERT INTO public.player_portal_accounts (display_name, pin, notify_all)
VALUES ('Test Account', '0000', true)
ON CONFLICT (display_name) DO UPDATE SET notify_all = true;

NOTIFY pgrst, 'reload schema';
