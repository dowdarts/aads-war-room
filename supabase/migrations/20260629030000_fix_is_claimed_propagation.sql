-- sync_account_create() auto-creates sibling rows with whatever pin the
-- triggering insert had, but always defaulted is_claimed to its column
-- default (true) — so seeding an unclaimed player_portal_accounts row
-- (pin='unset', is_claimed=false) created a matching staff_accounts row
-- that was *also* unsignable (pin='unset') but incorrectly flagged
-- is_claimed=true, which would have shown it in the Sign In dropdown as
-- if it were ready to use. Set is_claimed based on the actual pin instead
-- of defaulting, on both tables that have the column.
CREATE OR REPLACE FUNCTION public.sync_account_create()
RETURNS trigger AS $$
DECLARE
  acct_name text;
  acct_pin text;
  acct_claimed boolean;
  tp_type text;
BEGIN
  IF TG_TABLE_NAME = 'staff_accounts' THEN
    acct_name := NEW.name;
  ELSE
    acct_name := NEW.display_name;
  END IF;
  acct_pin := NEW.pin;
  acct_claimed := (acct_pin <> 'unset');

  IF TG_TABLE_NAME != 'staff_accounts' AND NOT EXISTS (
    SELECT 1 FROM public.staff_accounts WHERE lower(trim(name)) = lower(trim(acct_name))
  ) THEN
    SELECT data_type INTO tp_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'tool_permissions';
    IF tp_type = 'jsonb' THEN
      INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions, is_claimed)
      VALUES (acct_name, acct_pin, false, true, '[]'::jsonb, acct_claimed)
      ON CONFLICT (name) DO NOTHING;
    ELSE
      INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions, is_claimed)
      VALUES (acct_name, acct_pin, false, true, ARRAY[]::text[], acct_claimed)
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;

  IF TG_TABLE_NAME != 'player_portal_accounts' AND NOT EXISTS (
    SELECT 1 FROM public.player_portal_accounts WHERE lower(trim(display_name)) = lower(trim(acct_name))
  ) THEN
    INSERT INTO public.player_portal_accounts (display_name, pin, is_claimed)
    VALUES (acct_name, acct_pin, acct_claimed)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  IF TG_TABLE_NAME != 'scorekeeper_portal_accounts' AND NOT EXISTS (
    SELECT 1 FROM public.scorekeeper_portal_accounts WHERE lower(trim(display_name)) = lower(trim(acct_name))
  ) THEN
    INSERT INTO public.scorekeeper_portal_accounts (display_name, pin)
    VALUES (acct_name, acct_pin)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Corrective pass for rows already created by the buggy version above —
-- the only valid invariant is "placeholder pin implies unclaimed."
UPDATE public.staff_accounts SET is_claimed = false WHERE pin = 'unset' AND is_claimed = true;
UPDATE public.player_portal_accounts SET is_claimed = false WHERE pin = 'unset' AND is_claimed = true;

NOTIFY pgrst, 'reload schema';
