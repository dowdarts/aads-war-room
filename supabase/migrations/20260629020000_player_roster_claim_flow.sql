-- Same claim-flow pattern as staff_accounts (see
-- 20260629010000_staff_roster_claim_flow.sql), now for players: the 6
-- Tournament of Champions finalists need accounts pre-seeded so their
-- names show up to be claimed, but only Tom Holden already has one (and
-- his needs resetting — see below).
ALTER TABLE public.player_portal_accounts ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT true;

INSERT INTO public.player_portal_accounts (display_name, pin, notify_all, is_claimed)
VALUES
  ('Kyle Gray',        'unset', false, false),
  ('Tyler Cyr',        'unset', false, false),
  ('Darrell Cormier',  'unset', false, false),
  ('Drake Berry',      'unset', false, false),
  ('Rob Sibbick',      'unset', false, false)
ON CONFLICT (display_name) DO NOTHING;

-- Tom Holden's existing pin ("1234") was never actually his own choice —
-- reset it back to unclaimed so he goes through the same "pick your name,
-- set your own PIN" flow as everyone else. Resetting staff_accounts.pin
-- cascades to player_portal_accounts/scorekeeper_portal_accounts via the
-- existing sync_account_pin_update trigger; is_claimed only exists on
-- staff_accounts and player_portal_accounts so those need setting directly.
UPDATE public.staff_accounts SET pin = 'unset', is_claimed = false
  WHERE lower(trim(name)) = 'tom holden';
UPDATE public.player_portal_accounts SET is_claimed = false
  WHERE lower(trim(display_name)) = 'tom holden';

NOTIFY pgrst, 'reload schema';
