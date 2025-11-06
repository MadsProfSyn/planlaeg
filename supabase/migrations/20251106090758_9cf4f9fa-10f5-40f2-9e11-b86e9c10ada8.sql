-- Create availability_time_ranges table
CREATE TABLE availability_time_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id UUID NOT NULL REFERENCES supabase_availability(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_order CHECK (end_time > start_time),
  CONSTRAINT within_working_hours CHECK (
    start_time >= '08:00:00'::time AND 
    end_time <= '18:00:00'::time
  )
);

-- Create index for performance
CREATE INDEX idx_time_ranges_availability ON availability_time_ranges(availability_id);

-- Enable RLS
ALTER TABLE availability_time_ranges ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for time ranges" 
ON availability_time_ranges 
FOR SELECT 
USING (true);

-- Authenticated users can manage time ranges
CREATE POLICY "Authenticated users can insert time ranges" 
ON availability_time_ranges 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update time ranges" 
ON availability_time_ranges 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete time ranges" 
ON availability_time_ranges 
FOR DELETE 
USING (true);

-- Migrate existing time data (only valid ranges)
INSERT INTO availability_time_ranges (availability_id, start_time, end_time)
SELECT 
  id,
  COALESCE(start_time_local, '08:00'::time),
  CASE 
    WHEN end_time_local IS NULL OR end_time_local <= start_time_local THEN '16:00'::time
    ELSE end_time_local
  END
FROM supabase_availability
WHERE is_available = true
  AND (end_time_local IS NULL OR end_time_local > COALESCE(start_time_local, '08:00'::time));

-- Create function to set availability with multiple time ranges
CREATE OR REPLACE FUNCTION set_consultant_availability_with_ranges(
  p_inspector_id UUID,
  p_date DATE,
  p_is_available BOOLEAN,
  p_time_ranges JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'override'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inspector_name TEXT;
  v_department TEXT;
  v_availability_id UUID;
  v_result JSON;
  v_range JSONB;
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
  
  -- Upsert main availability record
  INSERT INTO supabase_availability (
    inspector_id,
    inspector_name,
    date_local,
    is_available,
    source,
    department,
    fetched_at
  ) VALUES (
    p_inspector_id,
    v_inspector_name,
    p_date,
    p_is_available,
    p_source,
    v_department,
    NOW()
  )
  ON CONFLICT (inspector_id, date_local)
  DO UPDATE SET
    is_available = EXCLUDED.is_available,
    source = EXCLUDED.source,
    fetched_at = NOW()
  RETURNING id INTO v_availability_id;
  
  -- If available and time ranges provided, update time ranges
  IF p_is_available AND p_time_ranges IS NOT NULL THEN
    -- Delete existing time ranges
    DELETE FROM availability_time_ranges 
    WHERE availability_id = v_availability_id;
    
    -- Insert new time ranges
    FOR v_range IN SELECT * FROM jsonb_array_elements(p_time_ranges)
    LOOP
      INSERT INTO availability_time_ranges (
        availability_id,
        start_time,
        end_time
      ) VALUES (
        v_availability_id,
        (v_range->>'start_time')::time,
        (v_range->>'end_time')::time
      );
    END LOOP;
  END IF;
  
  -- If not available, delete all time ranges
  IF NOT p_is_available THEN
    DELETE FROM availability_time_ranges 
    WHERE availability_id = v_availability_id;
  END IF;
  
  -- Return success result
  SELECT json_build_object(
    'success', true,
    'inspector_id', p_inspector_id,
    'inspector_name', v_inspector_name,
    'date', p_date,
    'is_available', p_is_available,
    'source', p_source,
    'availability_id', v_availability_id
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;