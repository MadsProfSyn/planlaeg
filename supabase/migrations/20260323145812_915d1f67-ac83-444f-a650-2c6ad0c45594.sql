
-- Enable RLS on inspection_durations
ALTER TABLE public.inspection_durations ENABLE ROW LEVEL SECURITY;

-- SELECT for authenticated users
CREATE POLICY "Authenticated users can read durations"
  ON public.inspection_durations
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE for admin only
CREATE POLICY "Admins can update durations"
  ON public.inspection_durations
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create modifiers table for DYMO/Cylinderskift
CREATE TABLE public.inspection_duration_modifiers (
  modifier_name TEXT PRIMARY KEY,
  minutes INTEGER NOT NULL DEFAULT 0,
  applies_to TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.inspection_duration_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read modifiers"
  ON public.inspection_duration_modifiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update modifiers"
  ON public.inspection_duration_modifiers
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed modifier data
INSERT INTO public.inspection_duration_modifiers (modifier_name, minutes, applies_to) VALUES
  ('DYMO', 5, '{IF,PS}'),
  ('Cylinderskift', 10, '{IF,PS}');
