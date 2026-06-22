-- Multi-event support: replaces the single app_settings row keyed
-- 'cue_light_event' with one row per event in a dedicated table, so
-- cue-light.html and players-portal.html can manage/select among
-- multiple events instead of always operating on one global schedule.
--
-- state holds the same shape used today:
-- { light, matches[], currentMatchId, alertsEnabled, portalAlertsEnabled,
--   doorsOpenedAt, updatedAt }

CREATE TABLE IF NOT EXISTS public.events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  state      jsonb NOT NULL DEFAULT '{"light":"off","matches":[],"updatedAt":null,"alertsEnabled":true,"portalAlertsEnabled":true,"currentMatchId":null,"doorsOpenedAt":null}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon select events" ON public.events;
CREATE POLICY "anon select events" ON public.events
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon insert events" ON public.events;
CREATE POLICY "anon insert events" ON public.events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon update events" ON public.events;
CREATE POLICY "anon update events" ON public.events
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.events TO anon;

-- Carry the existing single event's live schedule/state into the new
-- table so nothing is lost. app_settings.value is a text column holding
-- the JSON-encoded state string (see cue-light.html saveState).
INSERT INTO public.events (name, state)
SELECT 'Tournament of Champions', value::jsonb
FROM public.app_settings
WHERE key = 'cue_light_event'
  AND NOT EXISTS (SELECT 1 FROM public.events);

NOTIFY pgrst, 'reload schema';
