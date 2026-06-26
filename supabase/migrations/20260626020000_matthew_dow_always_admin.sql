-- Matthew Dow is always the admin across all three account systems, even on
-- events/matches/shifts where his name isn't literally on the schedule.
-- Enforced with triggers (not app code) so it holds no matter which UI path
-- creates or edits his rows, and self-heals if a row is ever edited.

-- Score Keeper Portal gets the same "receive everything regardless of name
-- match" column the Players Portal already has (see
-- 20260620200000_add_players_portal_test_account.sql).
ALTER TABLE public.scorekeeper_portal_accounts
  ADD COLUMN IF NOT EXISTS notify_all boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_staff_admin()
RETURNS trigger AS $$
BEGIN
  IF NEW.name = 'Matthew Dow' THEN
    NEW.is_master := true;
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_admin ON public.staff_accounts;
CREATE TRIGGER trg_staff_admin
  BEFORE INSERT OR UPDATE ON public.staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_admin();

CREATE OR REPLACE FUNCTION public.enforce_portal_admin()
RETURNS trigger AS $$
BEGIN
  IF NEW.display_name = 'Matthew Dow' THEN
    NEW.notify_all := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_player_portal_admin ON public.player_portal_accounts;
CREATE TRIGGER trg_player_portal_admin
  BEFORE INSERT OR UPDATE ON public.player_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_portal_admin();

DROP TRIGGER IF EXISTS trg_scorekeeper_portal_admin ON public.scorekeeper_portal_accounts;
CREATE TRIGGER trg_scorekeeper_portal_admin
  BEFORE INSERT OR UPDATE ON public.scorekeeper_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_portal_admin();

-- Backfill any existing Matthew Dow rows immediately, not just future ones.
UPDATE public.staff_accounts SET is_master = true, is_active = true WHERE name = 'Matthew Dow';
UPDATE public.player_portal_accounts SET notify_all = true WHERE display_name = 'Matthew Dow';
UPDATE public.scorekeeper_portal_accounts SET notify_all = true WHERE display_name = 'Matthew Dow';

NOTIFY pgrst, 'reload schema';
