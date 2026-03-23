CREATE OR REPLACE FUNCTION extract_inspection_flags()
RETURNS TRIGGER AS $$
DECLARE
  combined_note TEXT;
BEGIN
  combined_note := UPPER(
    COALESCE(NEW.note, '') || ' ' || COALESCE(NEW.raw->>'Note', '')
  );

  NEW.has_dymo := combined_note LIKE '%DYMO%';
  NEW.has_cylinderskift := (
    combined_note LIKE '%CYLINDERSKIFT%' OR
    combined_note LIKE '%CYLINDER%'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;