-- The previous migration's "is this Matthew Dow" check used exact `=`,
-- which would miss "matthew dow" or "MATTHEW DOW" — make it case/whitespace
-- insensitive, matching the same name-matching tolerance now used elsewhere
-- (sign-in/dup-check lookups switched to ilike, schedule matching is
-- case-insensitive too).

CREATE OR REPLACE FUNCTION public.enforce_staff_admin()
RETURNS trigger AS $$
BEGIN
  IF lower(trim(NEW.name)) = 'matthew dow' THEN
    NEW.is_master := true;
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.enforce_portal_admin()
RETURNS trigger AS $$
BEGIN
  IF lower(trim(NEW.display_name)) = 'matthew dow' THEN
    NEW.notify_all := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE public.staff_accounts SET is_master = true, is_active = true WHERE lower(trim(name)) = 'matthew dow';
UPDATE public.player_portal_accounts SET notify_all = true WHERE lower(trim(display_name)) = 'matthew dow';
UPDATE public.scorekeeper_portal_accounts SET notify_all = true WHERE lower(trim(display_name)) = 'matthew dow';

NOTIFY pgrst, 'reload schema';
