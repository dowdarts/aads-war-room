-- Reset specific staff accounts so they appear in the myaadsaccount.html
-- Create Account flow rather than Sign In. Their old staff PIN is cleared;
-- they will set a new password when they create their My AADS Account.
UPDATE public.staff_accounts
SET pin = 'unset', is_claimed = false
WHERE name IN ('Zach Davis', 'Aubrey Holland', 'Tanya Holland', 'Connie Dow', 'Cecil Dow');

NOTIFY pgrst, 'reload schema';
