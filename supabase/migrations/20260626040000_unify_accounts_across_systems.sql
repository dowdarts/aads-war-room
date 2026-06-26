-- One signup now works everywhere: creating a Staff, Player, or Score
-- Keeper account automatically creates matching accounts (same name+pin)
-- in the other two systems too, so nobody has to sign up three times.
-- Staff access still has to be deliberately granted per tool by Matthew —
-- this only means the *account* exists everywhere, not that it can do
-- anything in the Staff dashboard by default (see the tool_permissions
-- default revert below).
--
-- All "does this person already have an account here" checks are
-- case-insensitive (lower(trim(...))), not just ON CONFLICT on the exact
-- string — production already has a few case-variant rows for the same
-- person (e.g. "matthew dow" vs "Matthew Dow" in different tables), and a
-- naive exact-match conflict check would create yet another duplicate
-- instead of recognizing the account already exists.

-- staff_accounts.name had no DB-level uniqueness before now (only an
-- app-level check) — needed as the ON CONFLICT target below.
CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_name_unique_idx ON public.staff_accounts (name);

CREATE OR REPLACE FUNCTION public.sync_account_create()
RETURNS trigger AS $$
DECLARE
  acct_name text;
  acct_pin text;
  tp_type text;
BEGIN
  IF TG_TABLE_NAME = 'staff_accounts' THEN
    acct_name := NEW.name;
  ELSE
    acct_name := NEW.display_name;
  END IF;
  acct_pin := NEW.pin;

  IF TG_TABLE_NAME != 'staff_accounts' AND NOT EXISTS (
    SELECT 1 FROM public.staff_accounts WHERE lower(trim(name)) = lower(trim(acct_name))
  ) THEN
    SELECT data_type INTO tp_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'tool_permissions';
    IF tp_type = 'jsonb' THEN
      INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
      VALUES (acct_name, acct_pin, false, true, '[]'::jsonb)
      ON CONFLICT (name) DO NOTHING;
    ELSE
      INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
      VALUES (acct_name, acct_pin, false, true, ARRAY[]::text[])
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;

  IF TG_TABLE_NAME != 'player_portal_accounts' AND NOT EXISTS (
    SELECT 1 FROM public.player_portal_accounts WHERE lower(trim(display_name)) = lower(trim(acct_name))
  ) THEN
    INSERT INTO public.player_portal_accounts (display_name, pin)
    VALUES (acct_name, acct_pin)
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

DROP TRIGGER IF EXISTS trg_staff_account_sync_create ON public.staff_accounts;
CREATE TRIGGER trg_staff_account_sync_create
  AFTER INSERT ON public.staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_create();

DROP TRIGGER IF EXISTS trg_player_account_sync_create ON public.player_portal_accounts;
CREATE TRIGGER trg_player_account_sync_create
  AFTER INSERT ON public.player_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_create();

DROP TRIGGER IF EXISTS trg_scorekeeper_account_sync_create ON public.scorekeeper_portal_accounts;
CREATE TRIGGER trg_scorekeeper_account_sync_create
  AFTER INSERT ON public.scorekeeper_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_create();

-- Keep the PIN in sync everywhere too, so changing your code on one
-- portal doesn't leave the other two stuck on the old one. Only updates
-- accounts that already exist in the sibling tables (matched
-- case-insensitively) — doesn't create new rows from an update.
CREATE OR REPLACE FUNCTION public.sync_account_pin_update()
RETURNS trigger AS $$
DECLARE
  acct_name text;
BEGIN
  IF TG_TABLE_NAME = 'staff_accounts' THEN
    acct_name := NEW.name;
  ELSE
    acct_name := NEW.display_name;
  END IF;

  IF TG_TABLE_NAME != 'staff_accounts' THEN
    UPDATE public.staff_accounts SET pin = NEW.pin WHERE lower(trim(name)) = lower(trim(acct_name));
  END IF;
  IF TG_TABLE_NAME != 'player_portal_accounts' THEN
    UPDATE public.player_portal_accounts SET pin = NEW.pin WHERE lower(trim(display_name)) = lower(trim(acct_name));
  END IF;
  IF TG_TABLE_NAME != 'scorekeeper_portal_accounts' THEN
    UPDATE public.scorekeeper_portal_accounts SET pin = NEW.pin WHERE lower(trim(display_name)) = lower(trim(acct_name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_account_sync_pin ON public.staff_accounts;
CREATE TRIGGER trg_staff_account_sync_pin
  AFTER UPDATE OF pin ON public.staff_accounts
  FOR EACH ROW WHEN (OLD.pin IS DISTINCT FROM NEW.pin)
  EXECUTE FUNCTION public.sync_account_pin_update();

DROP TRIGGER IF EXISTS trg_player_account_sync_pin ON public.player_portal_accounts;
CREATE TRIGGER trg_player_account_sync_pin
  AFTER UPDATE OF pin ON public.player_portal_accounts
  FOR EACH ROW WHEN (OLD.pin IS DISTINCT FROM NEW.pin)
  EXECUTE FUNCTION public.sync_account_pin_update();

DROP TRIGGER IF EXISTS trg_scorekeeper_account_sync_pin ON public.scorekeeper_portal_accounts;
CREATE TRIGGER trg_scorekeeper_account_sync_pin
  AFTER UPDATE OF pin ON public.scorekeeper_portal_accounts
  FOR EACH ROW WHEN (OLD.pin IS DISTINCT FROM NEW.pin)
  EXECUTE FUNCTION public.sync_account_pin_update();

-- Backfill: every existing account in any one table gets matching
-- sibling rows created now too, not just from this point forward. Each
-- insert is guarded by the same case-insensitive existence check as the
-- trigger above, so a pre-existing case-variant row (e.g. "matthew dow"
-- already in player_portal_accounts) is recognized as already covering
-- that person instead of getting a second, differently-cased row created
-- alongside it.
DO $$
DECLARE
  r record;
  tp_type text;
BEGIN
  SELECT data_type INTO tp_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'tool_permissions';

  FOR r IN SELECT name AS acct_name, pin AS acct_pin FROM public.staff_accounts LOOP
    IF NOT EXISTS (SELECT 1 FROM public.player_portal_accounts WHERE lower(trim(display_name)) = lower(trim(r.acct_name))) THEN
      INSERT INTO public.player_portal_accounts (display_name, pin) VALUES (r.acct_name, r.acct_pin) ON CONFLICT (display_name) DO NOTHING;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.scorekeeper_portal_accounts WHERE lower(trim(display_name)) = lower(trim(r.acct_name))) THEN
      INSERT INTO public.scorekeeper_portal_accounts (display_name, pin) VALUES (r.acct_name, r.acct_pin) ON CONFLICT (display_name) DO NOTHING;
    END IF;
  END LOOP;

  FOR r IN SELECT display_name AS acct_name, pin AS acct_pin FROM public.player_portal_accounts LOOP
    IF NOT EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(trim(name)) = lower(trim(r.acct_name))) THEN
      IF tp_type = 'jsonb' THEN
        INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
          VALUES (r.acct_name, r.acct_pin, false, true, '[]'::jsonb) ON CONFLICT (name) DO NOTHING;
      ELSE
        INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
          VALUES (r.acct_name, r.acct_pin, false, true, ARRAY[]::text[]) ON CONFLICT (name) DO NOTHING;
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.scorekeeper_portal_accounts WHERE lower(trim(display_name)) = lower(trim(r.acct_name))) THEN
      INSERT INTO public.scorekeeper_portal_accounts (display_name, pin) VALUES (r.acct_name, r.acct_pin) ON CONFLICT (display_name) DO NOTHING;
    END IF;
  END LOOP;

  FOR r IN SELECT display_name AS acct_name, pin AS acct_pin FROM public.scorekeeper_portal_accounts LOOP
    IF NOT EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(trim(name)) = lower(trim(r.acct_name))) THEN
      IF tp_type = 'jsonb' THEN
        INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
          VALUES (r.acct_name, r.acct_pin, false, true, '[]'::jsonb) ON CONFLICT (name) DO NOTHING;
      ELSE
        INSERT INTO public.staff_accounts (name, pin, is_master, is_active, tool_permissions)
          VALUES (r.acct_name, r.acct_pin, false, true, ARRAY[]::text[]) ON CONFLICT (name) DO NOTHING;
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.player_portal_accounts WHERE lower(trim(display_name)) = lower(trim(r.acct_name))) THEN
      INSERT INTO public.player_portal_accounts (display_name, pin) VALUES (r.acct_name, r.acct_pin) ON CONFLICT (display_name) DO NOTHING;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
