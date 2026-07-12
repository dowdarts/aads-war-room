-- sync_account_pin_update() propagates a changed pin to sibling account
-- tables, but never touched is_claimed on the sibling row it just updated.
-- That let someone claim their account through one portal (which sets
-- pin + is_claimed=true on that table directly) while the trigger-synced
-- sibling row(s) picked up the real pin but stayed is_claimed=false —
-- e.g. Cecil Dow, Connie Dow, Dana Moss, Steve Rushton, Tyler Cyr all
-- ended up with working PINs but showed as "unclaimed" in the Staff
-- Management claim list. Set is_claimed alongside pin on every sync,
-- same "placeholder pin implies unclaimed" rule used elsewhere.
CREATE OR REPLACE FUNCTION public.sync_account_pin_update()
RETURNS trigger AS $$
DECLARE
  acct_name text;
  acct_claimed boolean;
BEGIN
  IF TG_TABLE_NAME = 'staff_accounts' THEN
    acct_name := NEW.name;
  ELSE
    acct_name := NEW.display_name;
  END IF;
  acct_claimed := (NEW.pin <> 'unset');

  IF TG_TABLE_NAME != 'staff_accounts' THEN
    UPDATE public.staff_accounts SET pin = NEW.pin, is_claimed = acct_claimed WHERE lower(trim(name)) = lower(trim(acct_name));
  END IF;
  IF TG_TABLE_NAME != 'player_portal_accounts' THEN
    UPDATE public.player_portal_accounts SET pin = NEW.pin, is_claimed = acct_claimed WHERE lower(trim(display_name)) = lower(trim(acct_name));
  END IF;
  IF TG_TABLE_NAME != 'scorekeeper_portal_accounts' THEN
    UPDATE public.scorekeeper_portal_accounts SET pin = NEW.pin WHERE lower(trim(display_name)) = lower(trim(acct_name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Corrective pass for accounts already stuck in this state: a real pin
-- is proof the account was claimed, regardless of what is_claimed says.
UPDATE public.staff_accounts SET is_claimed = true WHERE pin <> 'unset' AND is_claimed = false;
UPDATE public.player_portal_accounts SET is_claimed = true WHERE pin <> 'unset' AND is_claimed = false;

NOTIFY pgrst, 'reload schema';
