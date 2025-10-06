-- Drop heartbeat tracking function
DROP FUNCTION IF EXISTS public.record_heartbeat();

-- Drop activity tracking tables
DROP TABLE IF EXISTS public.user_activity_pings CASCADE;
DROP TABLE IF EXISTS public.user_activity_daily CASCADE;