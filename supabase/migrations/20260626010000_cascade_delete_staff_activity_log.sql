-- staff_activity_log.staff_id -> staff_accounts.id had no ON DELETE
-- behavior, so Postgres blocked deleting a staff_accounts row (e.g. via
-- the "Remove" button in Manage Staff) whenever that staff member had any
-- logged tool access. Switch to ON DELETE CASCADE so removing a staff
-- account also clears their activity log rows.

ALTER TABLE public.staff_activity_log
  DROP CONSTRAINT IF EXISTS staff_activity_log_staff_id_fkey;

ALTER TABLE public.staff_activity_log
  ADD CONSTRAINT staff_activity_log_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.staff_accounts(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
