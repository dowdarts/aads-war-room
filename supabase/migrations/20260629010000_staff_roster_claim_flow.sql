-- Pre-seeded staff accounts (the named roster of officials) need to exist
-- before anyone signs in, but shouldn't be usable until the real person
-- behind the name picks their own PIN — otherwise the first person to type
-- a name and guess right gets to "be" Dana Moss, Jayme, etc. is_claimed
-- distinguishes "this row exists so the name shows up to be claimed" from
-- "someone has actually set a real PIN and can sign in."
--
-- Existing accounts default to true (already usable, nothing changes for
-- them). New unclaimed rows are inserted with is_claimed = false and a
-- placeholder pin that can never match a real 4-digit code entered through
-- the sign-in form, so they can't be signed into even if someone guessed it
-- before the claim flow checks is_claimed.
ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT true;

INSERT INTO public.staff_accounts (name, pin, is_master, is_active, is_claimed)
VALUES
  ('Dana Moss',       'unset', false, true, false),
  ('Denis Leblanc',   'unset', false, true, false),
  ('Jayme',           'unset', false, true, false),
  ('Steve Rushton',   'unset', false, true, false),
  ('Cory Wallace',    'unset', false, true, false),
  ('Aubrey Holland',  'unset', false, true, false),
  ('Zach Davis',      'unset', false, true, false),
  ('Tyler Stewart',   'unset', false, true, false),
  ('Cecil Dow',       'unset', false, true, false),
  ('Kayla Melanson',  'unset', false, true, false),
  ('Tanya Holland',   'unset', false, true, false),
  ('Marie-Therese',   'unset', false, true, false),
  ('Dawn LeBlanc',    'unset', false, true, false),
  ('Connie Dow',      'unset', false, true, false),
  ('Jason Cole',      'unset', false, true, false),
  ('Steve Hicks',     'unset', false, true, false)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
