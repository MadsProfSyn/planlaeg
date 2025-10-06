-- Enable RLS policies for proposed_assignments table
ALTER TABLE proposed_assignments ENABLE ROW LEVEL SECURITY;

-- Allow public read access to proposed assignments
CREATE POLICY "Public read access for proposed assignments"
ON proposed_assignments
FOR SELECT
USING (true);

-- Allow public insert for new proposed assignments (from VRP approval)
CREATE POLICY "Public insert for proposed assignments"
ON proposed_assignments
FOR INSERT
WITH CHECK (true);