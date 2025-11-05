-- Create RPC function to manage consultant availability overrides
CREATE OR REPLACE FUNCTION public.set_consultant_availability(
  p_inspector_id uuid,
  p_date date,
  p_is_available boolean,
  p_source text DEFAULT 'override',
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inspector_name text;
  v_department text;
  v_result json;
BEGIN
  -- Validate inspector exists and is active
  SELECT i.full_name, d.name
  INTO v_inspector_name, v_department
  FROM inspectors i
  LEFT JOIN departments d ON d.id = i.department_id
  WHERE i.id = p_inspector_id AND i.is_active = true;
  
  IF v_inspector_name IS NULL THEN
    RAISE EXCEPTION 'Inspector not found or inactive: %', p_inspector_id;
  END IF;
  
  -- Validate date is not in the past
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot modify availability for past dates';
  END IF;
  
  -- Upsert availability record
  INSERT INTO supabase_availability (
    inspector_id,
    inspector_name,
    date_local,
    is_available,
    source,
    start_time_local,
    end_time_local,
    department,
    fetched_at
  ) VALUES (
    p_inspector_id,
    v_inspector_name,
    p_date,
    p_is_available,
    p_source,
    COALESCE(p_start_time, '08:00'::time),
    COALESCE(p_end_time, '16:00'::time),
    v_department,
    NOW()
  )
  ON CONFLICT (inspector_id, date_local)
  DO UPDATE SET
    is_available = EXCLUDED.is_available,
    source = EXCLUDED.source,
    start_time_local = COALESCE(EXCLUDED.start_time_local, supabase_availability.start_time_local),
    end_time_local = COALESCE(EXCLUDED.end_time_local, supabase_availability.end_time_local),
    fetched_at = NOW();
  
  -- Return success result
  SELECT json_build_object(
    'success', true,
    'inspector_id', p_inspector_id,
    'inspector_name', v_inspector_name,
    'date', p_date,
    'is_available', p_is_available,
    'source', p_source
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Add unique constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'supabase_availability_inspector_date_unique'
  ) THEN
    ALTER TABLE supabase_availability
    ADD CONSTRAINT supabase_availability_inspector_date_unique
    UNIQUE (inspector_id, date_local);
  END IF;
END $$;

-- Add RLS policy for authenticated users to manage availability overrides
DROP POLICY IF EXISTS "Authenticated users can insert availability overrides" ON supabase_availability;
CREATE POLICY "Authenticated users can insert availability overrides"
ON supabase_availability
FOR INSERT
TO authenticated
WITH CHECK (source = 'override');

DROP POLICY IF EXISTS "Authenticated users can update availability overrides" ON supabase_availability;
CREATE POLICY "Authenticated users can update availability overrides"
ON supabase_availability
FOR UPDATE
TO authenticated
USING (source = 'override')
WITH CHECK (source = 'override');