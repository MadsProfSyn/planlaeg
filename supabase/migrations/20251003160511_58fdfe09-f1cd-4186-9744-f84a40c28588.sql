-- Create afdeling to department translation table
CREATE TABLE public.afdeling_to_department (
  afdeling TEXT PRIMARY KEY,
  department TEXT NOT NULL
);

-- Seed department translations
INSERT INTO public.afdeling_to_department (afdeling, department) VALUES
  ('Aalborg', 'Aalborg'),
  ('Aarhus', 'Århus'),
  ('Fyn', 'Odense'),
  ('Sjælland', 'Storkøbenhavn');

-- Create postcode to afdeling mapping table
CREATE TABLE public.afdeling_zip (
  zip INTEGER PRIMARY KEY,
  afdeling TEXT NOT NULL REFERENCES public.afdeling_to_department(afdeling)
);

-- Create index for faster lookups
CREATE INDEX idx_afdeling_zip_afdeling ON public.afdeling_zip(afdeling);

-- Enable RLS
ALTER TABLE public.afdeling_to_department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afdeling_zip ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for department mappings" 
ON public.afdeling_to_department 
FOR SELECT 
USING (true);

CREATE POLICY "Public read access for zip mappings" 
ON public.afdeling_zip 
FOR SELECT 
USING (true);

-- Create view to resolve department from postcode
CREATE OR REPLACE VIEW public.vw_postcode_to_department AS
SELECT 
  az.zip,
  az.afdeling,
  atd.department
FROM public.afdeling_zip az
JOIN public.afdeling_to_department atd ON az.afdeling = atd.afdeling;

COMMENT ON TABLE public.afdeling_zip IS 'Maps postcodes to Afdeling. Populate with exact postcode lists for: Aalborg, Aarhus, Fyn, Sjælland';
COMMENT ON TABLE public.afdeling_to_department IS 'Translates Afdeling names to Department names used in UI';