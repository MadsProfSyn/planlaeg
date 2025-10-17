-- Remove duplicate rows, keeping only the most recent one based on fetched_at
DELETE FROM supabase_availability a
USING supabase_availability b
WHERE a.id < b.id
  AND a.inspector_id = b.inspector_id
  AND a.date_local = b.date_local
  AND a.source = b.source;

-- Add unique constraint to prevent future duplicates
ALTER TABLE supabase_availability 
ADD CONSTRAINT supabase_availability_inspector_date_source_key 
UNIQUE (inspector_id, date_local, source);