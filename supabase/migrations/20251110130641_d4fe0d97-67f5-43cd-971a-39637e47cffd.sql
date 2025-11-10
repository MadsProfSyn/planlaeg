-- Create function to map inspection types to WorkFeed role IDs
CREATE OR REPLACE FUNCTION get_wf_role_id_for_inspection(p_inspection_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_abbreviation TEXT;
  v_wf_role_id TEXT;
BEGIN
  -- Get abbreviation from inspection type
  SELECT abbreviation INTO v_abbreviation
  FROM inspection_type_mappings
  WHERE full_name = p_inspection_type
  LIMIT 1;
  
  IF v_abbreviation IS NULL THEN
    RAISE EXCEPTION 'Unknown inspection type: %', p_inspection_type;
  END IF;
  
  -- Get wf_role_id from role mappings
  SELECT wf_role_id INTO v_wf_role_id
  FROM role_mappings
  WHERE wf_role_name = v_abbreviation
  LIMIT 1;
  
  IF v_wf_role_id IS NULL THEN
    RAISE EXCEPTION 'No WorkFeed role ID found for: %', v_abbreviation;
  END IF;
  
  RETURN v_wf_role_id;
END;
$$;