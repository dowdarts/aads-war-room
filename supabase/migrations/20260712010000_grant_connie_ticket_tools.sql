-- Grant Connie Dow access to the Tickets Dashboard (issue/manage tickets)
-- and Ticket Check-in (door desk) tools, per Matthew's direction that she
-- runs the main check-in desk and handles ticket issuance/issues.
UPDATE public.staff_accounts
SET tool_permissions = (
  SELECT jsonb_agg(DISTINCT val)
  FROM (
    SELECT jsonb_array_elements(
      COALESCE(tool_permissions, '[]'::jsonb) || '["ticket-sales","checkin"]'::jsonb
    ) AS val
  ) t
)
WHERE name = 'Connie Dow';

NOTIFY pgrst, 'reload schema';
