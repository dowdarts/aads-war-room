-- Give every staff account Staff Chat and QR Scanner as base tool permissions.
-- Uses jsonb_array_elements to avoid duplicating entries that may already exist.
UPDATE public.staff_accounts
SET tool_permissions = (
  SELECT jsonb_agg(DISTINCT val)
  FROM (
    SELECT jsonb_array_elements(
      COALESCE(tool_permissions, '[]'::jsonb) || '["staff-chat","scanner"]'::jsonb
    ) AS val
  ) t
);

NOTIFY pgrst, 'reload schema';
