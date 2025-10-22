-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==============================================================================
-- CRON JOB 1: Daily Cleanup at 01:00 UTC (~02:00-03:00 Copenhagen)
-- ==============================================================================
-- Removes old data from shifts, availability, and proposed assignments
SELECT cron.schedule(
  'daily-cleanup-old-data',
  '0 1 * * *', -- Every day at 01:00 UTC
  $$
  DELETE FROM supabase_shifts WHERE date_local < CURRENT_DATE;
  DELETE FROM supabase_availability WHERE date_local < CURRENT_DATE;
  DELETE FROM proposed_assignments WHERE scheduled_date < CURRENT_DATE;
  $$
);

-- ==============================================================================
-- CRON JOB 2: Daily Shift Sync at 02:00 UTC (~03:00-04:00 Copenhagen)
-- ==============================================================================
-- Syncs shifts from Workfeed API for today + 30 days ahead
SELECT cron.schedule(
  'daily-shift-sync',
  '0 2 * * *', -- Every day at 02:00 UTC
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-shifts-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ==============================================================================
-- VERIFICATION: List all daily cron jobs
-- ==============================================================================
SELECT 
  jobid, 
  jobname, 
  schedule, 
  active,
  database
FROM cron.job 
WHERE jobname LIKE 'daily-%'
ORDER BY jobname;