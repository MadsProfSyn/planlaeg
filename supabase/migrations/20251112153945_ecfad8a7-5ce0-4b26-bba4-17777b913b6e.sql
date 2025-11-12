-- Phase 1: Update RPC function to store aggregated times
CREATE OR REPLACE FUNCTION public.set_consultant_availability_with_ranges(
  p_inspector_id uuid,
  p_date date,
  p_is_available boolean,
  p_time_ranges jsonb DEFAULT NULL::jsonb,
  p_source text DEFAULT 'override'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inspector_name TEXT;
  v_department TEXT;
  v_availability_id UUID;
  v_min_start_time TIME;
  v_max_end_time TIME;
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
  
  -- Calculate aggregated times from ranges if available and is_available is true
  IF p_is_available AND p_time_ranges IS NOT NULL AND jsonb_array_length(p_time_ranges) > 0 THEN
    SELECT 
      MIN((range->>'start_time')::time),
      MAX((range->>'end_time')::time)
    INTO v_min_start_time, v_max_end_time
    FROM jsonb_array_elements(p_time_ranges) AS range;
  ELSIF p_is_available THEN
    -- Default times for available without ranges
    v_min_start_time := '08:00'::time;
    v_max_end_time := '16:00'::time;
  ELSE
    -- Not available - set NULL
    v_min_start_time := NULL;
    v_max_end_time := NULL;
  END IF;
  
  -- Upsert main availability record WITH aggregated times
  INSERT INTO supabase_availability (
    inspector_id,
    inspector_name,
    date_local,
    is_available,
    source,
    department,
    start_time_local,
    end_time_local,
    fetched_at
  ) VALUES (
    p_inspector_id,
    v_inspector_name,
    p_date,
    p_is_available,
    p_source,
    v_department,
    v_min_start_time,
    v_max_end_time,
    NOW()
  )
  ON CONFLICT (inspector_id, date_local)
  DO UPDATE SET
    is_available = EXCLUDED.is_available,
    source = EXCLUDED.source,
    start_time_local = EXCLUDED.start_time_local,
    end_time_local = EXCLUDED.end_time_local,
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
    'availability_id', v_availability_id,
    'start_time_local', v_min_start_time,
    'end_time_local', v_max_end_time
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Phase 2: Backfill existing NULL values
-- Step 1: Backfill from availability_time_ranges
UPDATE supabase_availability sa
SET 
  start_time_local = ranges.min_start,
  end_time_local = ranges.max_end
FROM (
  SELECT 
    availability_id,
    MIN(start_time) as min_start,
    MAX(end_time) as max_end
  FROM availability_time_ranges
  GROUP BY availability_id
) ranges
WHERE sa.id = ranges.availability_id
  AND sa.is_available = true
  AND (sa.start_time_local IS NULL OR sa.end_time_local IS NULL);

-- Step 2: Set default times for available inspectors with no ranges
UPDATE supabase_availability
SET 
  start_time_local = '08:00'::time,
  end_time_local = '16:00'::time
WHERE is_available = true
  AND (start_time_local IS NULL OR end_time_local IS NULL)
  AND id NOT IN (SELECT availability_id FROM availability_time_ranges);