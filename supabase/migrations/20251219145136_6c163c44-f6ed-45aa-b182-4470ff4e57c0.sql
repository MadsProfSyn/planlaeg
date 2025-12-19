-- Add columns to monday_items_selected for schedule tracking
ALTER TABLE monday_items_selected 
ADD COLUMN IF NOT EXISTS schedule_status text DEFAULT 'unscheduled',
ADD COLUMN IF NOT EXISTS wf_shift_id text,
ADD COLUMN IF NOT EXISTS scheduled_inspector_id uuid REFERENCES inspectors(id),
ADD COLUMN IF NOT EXISTS scheduled_start_time time,
ADD COLUMN IF NOT EXISTS scheduled_end_time time,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduled_by uuid;

-- Add constraint for valid status values (using DO block to avoid error if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monday_items_schedule_status_check'
  ) THEN
    ALTER TABLE monday_items_selected 
    ADD CONSTRAINT monday_items_schedule_status_check 
    CHECK (schedule_status IN ('unscheduled', 'scheduled', 'sent_to_workfeed'));
  END IF;
END $$;

-- Create index for filtering unscheduled items
CREATE INDEX IF NOT EXISTS idx_monday_items_schedule_status 
ON monday_items_selected(schedule_status);