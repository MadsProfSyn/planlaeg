-- Backfill: touch all rows to trigger extract_inspection_flags()
-- This is a one-time data fix, using a no-op update to fire the trigger
UPDATE monday_items_selected SET note = note WHERE raw IS NOT NULL OR note IS NOT NULL;