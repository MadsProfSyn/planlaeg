-- Add manual assignment tracking to proposed_assignments table
ALTER TABLE proposed_assignments
ADD COLUMN assignment_source text DEFAULT 'vrp' CHECK (assignment_source IN ('vrp', 'manual')),
ADD COLUMN manual_override_at timestamp with time zone,
ADD COLUMN manual_override_by uuid REFERENCES profiles(id);

-- Create index for filtering manual assignments
CREATE INDEX idx_proposed_assignments_source ON proposed_assignments(assignment_source);
CREATE INDEX idx_proposed_assignments_inspector ON proposed_assignments(inspector_id, scheduled_date);

-- Update RLS policies to allow authenticated users to update assignments
DROP POLICY IF EXISTS "Authenticated users can update assignments" ON proposed_assignments;
CREATE POLICY "Authenticated users can update assignments" 
ON proposed_assignments 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Create function for manual inspector reassignment
CREATE OR REPLACE FUNCTION public.reassign_inspector_manual(
  p_assignment_id uuid,
  p_new_inspector_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inspector_name text;
  v_inspection_type text;
  v_scheduled_date date;
  v_start_time time;
  v_end_time time;
  v_result json;
BEGIN
  -- Get inspector details and validate
  SELECT full_name INTO v_inspector_name
  FROM inspectors
  WHERE id = p_new_inspector_id AND is_active = true;
  
  IF v_inspector_name IS NULL THEN
    RAISE EXCEPTION 'Inspector not found or inactive';
  END IF;
  
  -- Get assignment details
  SELECT 
    iq.inspection_type,
    pa.scheduled_date,
    pa.start_time,
    pa.end_time
  INTO v_inspection_type, v_scheduled_date, v_start_time, v_end_time
  FROM proposed_assignments pa
  JOIN inspection_queue iq ON iq.id = pa.inspection_id
  WHERE pa.id = p_assignment_id;
  
  IF v_scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;
  
  -- Update the assignment
  UPDATE proposed_assignments
  SET 
    inspector_id = p_new_inspector_id,
    assignment_source = 'manual',
    manual_override_at = NOW(),
    manual_override_by = p_user_id
  WHERE id = p_assignment_id;
  
  -- Return success result
  SELECT json_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'new_inspector_id', p_new_inspector_id,
    'inspector_name', v_inspector_name,
    'inspection_type', v_inspection_type,
    'scheduled_date', v_scheduled_date
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;