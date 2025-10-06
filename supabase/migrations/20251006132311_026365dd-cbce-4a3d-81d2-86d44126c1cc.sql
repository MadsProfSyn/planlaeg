-- Add planned_by tracking to inspection_queue
ALTER TABLE inspection_queue ADD COLUMN IF NOT EXISTS planned_by uuid REFERENCES auth.users(id);

-- Create view for inspections with planner info
CREATE OR REPLACE VIEW inspections_with_planner AS
SELECT 
  iq.*,
  p.full_name as planner_name,
  p.email as planner_email,
  vr.created_at as planned_at
FROM inspection_queue iq
LEFT JOIN proposed_assignments pa ON pa.inspection_id = iq.id
LEFT JOIN vrp_runs vr ON vr.id = pa.vrp_run_id
LEFT JOIN profiles p ON p.id = CAST(vr.requested_by AS uuid);

-- Create secure RPC function to promote user to admin
CREATE OR REPLACE FUNCTION promote_user(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Check caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can promote users';
  END IF;
  
  -- Get user ID from email
  SELECT id INTO target_user_id 
  FROM profiles 
  WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert admin role
  INSERT INTO user_roles (user_id, role, granted_by)
  VALUES (target_user_id, 'admin', auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create secure RPC function to demote admin to user
CREATE OR REPLACE FUNCTION demote_admin(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Check caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can demote users';
  END IF;
  
  -- Get user ID from email
  SELECT id INTO target_user_id 
  FROM profiles 
  WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Delete admin role
  DELETE FROM user_roles 
  WHERE user_id = target_user_id 
  AND role = 'admin';
END;
$$;

-- Update RLS policies for inspection_queue
DROP POLICY IF EXISTS "Public read access for inspections" ON inspection_queue;
CREATE POLICY "Authenticated users can view inspections" ON inspection_queue
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public update access for inspections" ON inspection_queue;
CREATE POLICY "Planners and admins can update inspections" ON inspection_queue
  FOR UPDATE TO authenticated 
  USING (planned_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Update RLS policies for vrp_runs
DROP POLICY IF EXISTS "Public read for VRP runs" ON vrp_runs;
CREATE POLICY "Users can view their VRP runs" ON vrp_runs
  FOR SELECT TO authenticated 
  USING (CAST(requested_by AS uuid) = auth.uid() OR has_role(auth.uid(), 'admin'));