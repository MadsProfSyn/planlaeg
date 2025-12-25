-- Fix the CHECK constraint to allow 'scheduled_in_monday' status
ALTER TABLE monday_items_selected 
DROP CONSTRAINT IF EXISTS monday_items_schedule_status_check;

ALTER TABLE monday_items_selected 
ADD CONSTRAINT monday_items_schedule_status_check 
CHECK (schedule_status IS NULL OR schedule_status = ANY (ARRAY['unscheduled', 'scheduled', 'sent_to_workfeed', 'scheduled_in_monday']));