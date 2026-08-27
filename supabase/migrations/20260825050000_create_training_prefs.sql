-- Training Room (public/training.html) theme + appearance preferences.
-- One row per player_portal_accounts row — the same account players sign
-- into on Players Portal — so a theme choice made on one device loads on
-- every other device that player signs into.

CREATE TABLE IF NOT EXISTS public.training_prefs (
  player_id           uuid PRIMARY KEY REFERENCES public.player_portal_accounts(id) ON DELETE CASCADE,
  theme               text NOT NULL DEFAULT 'performance-dark',
  training_mode_theme boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon select training prefs" ON public.training_prefs;
CREATE POLICY "anon select training prefs" ON public.training_prefs
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon insert training prefs" ON public.training_prefs;
CREATE POLICY "anon insert training prefs" ON public.training_prefs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon update training prefs" ON public.training_prefs;
CREATE POLICY "anon update training prefs" ON public.training_prefs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.training_prefs TO anon;

NOTIFY pgrst, 'reload schema';
