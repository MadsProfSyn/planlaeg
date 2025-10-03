-- Populate afdeling_zip with exact postcode mappings

-- Sjælland postcodes
INSERT INTO public.afdeling_zip (zip, afdeling) VALUES
  (3300, 'Sjælland'), (2610, 'Sjælland'), (2400, 'Sjælland'), (3550, 'Sjælland'),
  (2630, 'Sjælland'), (3450, 'Sjælland'), (1572, 'Sjælland'), (2300, 'Sjælland'),
  (2860, 'Sjælland'), (2900, 'Sjælland'), (2600, 'Sjælland'), (2665, 'Sjælland'),
  (2880, 'Sjælland'), (4293, 'Sjælland'), (2830, 'Sjælland'), (2100, 'Sjælland'),
  (1315, 'Sjælland'), (3400, 'Sjælland'), (2500, 'Sjælland'), (3000, 'Sjælland'),
  (4000, 'Sjælland'), (2680, 'Sjælland'), (3520, 'Sjælland'), (3490, 'Sjælland'),
  (2200, 'Sjælland'), (2800, 'Sjælland'), (3460, 'Sjælland'), (2670, 'Sjælland'),
  (4200, 'Sjælland'), (3200, 'Sjælland'), (4300, 'Sjælland'), (2720, 'Sjælland'),
  (3600, 'Sjælland'), (2000, 'Sjælland'), (2750, 'Sjælland'), (4140, 'Sjælland'),
  (2970, 'Sjælland'), (1827, 'Sjælland'), (2920, 'Sjælland'), (3390, 'Sjælland'),
  (3630, 'Sjælland'), (4050, 'Sjælland'), (3060, 'Sjælland'), (1574, 'Sjælland'),
  (1573, 'Sjælland'), (2791, 'Sjælland'), (2730, 'Sjælland'), (2700, 'Sjælland'),
  (2740, 'Sjælland'), (3480, 'Sjælland'), (2820, 'Sjælland'), (4600, 'Sjælland'),
  (2765, 'Sjælland'), (2635, 'Sjælland')
ON CONFLICT (zip) DO NOTHING;

-- Fyn postcodes
INSERT INTO public.afdeling_zip (zip, afdeling) VALUES
  (5200, 'Fyn'), (5260, 'Fyn'), (5700, 'Fyn'), (5550, 'Fyn')
ON CONFLICT (zip) DO NOTHING;

-- Aarhus postcodes (note: using 'Aarhus' spelling as defined in afdeling_to_department)
INSERT INTO public.afdeling_zip (zip, afdeling) VALUES
  (7000, 'Aarhus'), (8240, 'Aarhus'), (8200, 'Aarhus'), (8260, 'Aarhus'),
  (8660, 'Aarhus'), (7400, 'Aarhus'), (8380, 'Aarhus'), (8220, 'Aarhus'),
  (6000, 'Aarhus'), (8722, 'Aarhus'), (8381, 'Aarhus'), (8000, 'Aarhus'),
  (8700, 'Aarhus'), (8362, 'Aarhus'), (8541, 'Aarhus'), (8270, 'Aarhus'),
  (8680, 'Aarhus'), (8230, 'Aarhus'), (8600, 'Aarhus'), (8800, 'Aarhus'),
  (7100, 'Aarhus')
ON CONFLICT (zip) DO NOTHING;

-- Aalborg postcodes
INSERT INTO public.afdeling_zip (zip, afdeling) VALUES
  (9220, 'Aalborg'), (9400, 'Aalborg'), (9230, 'Aalborg')
ON CONFLICT (zip) DO NOTHING;

-- Summary
DO $$
DECLARE
  aalborg_count INT;
  aarhus_count INT;
  fyn_count INT;
  sjaelland_count INT;
BEGIN
  SELECT COUNT(*) INTO aalborg_count FROM afdeling_zip WHERE afdeling = 'Aalborg';
  SELECT COUNT(*) INTO aarhus_count FROM afdeling_zip WHERE afdeling = 'Aarhus';
  SELECT COUNT(*) INTO fyn_count FROM afdeling_zip WHERE afdeling = 'Fyn';
  SELECT COUNT(*) INTO sjaelland_count FROM afdeling_zip WHERE afdeling = 'Sjælland';
  
  RAISE NOTICE 'Postcode mapping summary:';
  RAISE NOTICE '  Aalborg: % postcodes', aalborg_count;
  RAISE NOTICE '  Aarhus: % postcodes', aarhus_count;
  RAISE NOTICE '  Fyn: % postcodes', fyn_count;
  RAISE NOTICE '  Sjælland: % postcodes', sjaelland_count;
  RAISE NOTICE '  Total: % postcodes', aalborg_count + aarhus_count + fyn_count + sjaelland_count;
END $$;