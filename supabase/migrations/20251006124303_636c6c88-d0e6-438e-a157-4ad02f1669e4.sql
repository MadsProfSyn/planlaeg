-- Enable RLS for monday_items_selected
ALTER TABLE monday_items_selected ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access for monday items"
ON monday_items_selected
FOR SELECT
TO public
USING (true);

-- Allow public insert access
CREATE POLICY "Public insert access for monday items"
ON monday_items_selected
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public update access
CREATE POLICY "Public update access for monday items"
ON monday_items_selected
FOR UPDATE
TO public
USING (true);

-- Allow public delete access
CREATE POLICY "Public delete access for monday items"
ON monday_items_selected
FOR DELETE
TO public
USING (true);

-- Enable realtime for monday_items_selected
ALTER TABLE monday_items_selected REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE monday_items_selected;