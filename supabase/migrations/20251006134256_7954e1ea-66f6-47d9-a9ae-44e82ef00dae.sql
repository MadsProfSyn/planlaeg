-- =====================================================
-- Activity Tracking & Admin Promotion Migration (Fixed v2)
-- =====================================================

-- 1. Add planned_at column to inspection_queue if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inspection_queue' AND column_name='planned_at'
  ) THEN
    ALTER TABLE public.inspection_queue ADD COLUMN planned_at timestamptz;
  END IF;
END$$;

-- 2. Promote existing users to admin
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT 
  u.id, 
  'admin'::app_role,
  u.id
FROM auth.users u
WHERE lower(u.email) IN ('mads@profsyn.dk', 'anders@profsyn.dk')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Create activity tracking tables
CREATE TABLE IF NOT EXISTS public.user_activity_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  active_minutes int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS public.user_activity_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date 
  ON public.user_activity_daily(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user 
  ON public.user_activity_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_pings_user 
  ON public.user_activity_pings(user_id, pinged_at DESC);

-- 5. Enable RLS on activity tables
ALTER TABLE public.user_activity_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_pings ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies: users read own, admins read all, only server writes
DROP POLICY IF EXISTS "read_own_activity" ON public.user_activity_daily;
CREATE POLICY "read_own_activity" ON public.user_activity_daily
  FOR SELECT 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "read_own_pings" ON public.user_activity_pings;
CREATE POLICY "read_own_pings" ON public.user_activity_pings
  FOR SELECT 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Prevent direct client writes (only via RPC)
DROP POLICY IF EXISTS "server_only_write_activity" ON public.user_activity_daily;
CREATE POLICY "server_only_write_activity" ON public.user_activity_daily
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "server_only_write_pings" ON public.user_activity_pings;
CREATE POLICY "server_only_write_pings" ON public.user_activity_pings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 7. Create heartbeat RPC function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.record_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  d date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- Verify authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Log raw ping for audit/debugging
  INSERT INTO public.user_activity_pings(user_id, pinged_at)
  VALUES (auth.uid(), now());

  -- Upsert 1 active minute per heartbeat
  INSERT INTO public.user_activity_daily(user_id, activity_date, active_minutes, updated_at)
  VALUES (auth.uid(), d, 1, now())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET 
    active_minutes = public.user_activity_daily.active_minutes + 1,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_heartbeat() TO authenticated;

-- 8. Drop and recreate inspections_with_planner view
DROP VIEW IF EXISTS public.inspections_with_planner;
CREATE VIEW public.inspections_with_planner AS
SELECT
  iq.*,
  COALESCE(iq.planned_at, vr.created_at) as planned_at_resolved,
  p.full_name AS planner_name,
  p.email AS planner_email
FROM public.inspection_queue iq
LEFT JOIN public.proposed_assignments pa ON pa.inspection_id = iq.id
LEFT JOIN public.vrp_runs vr ON vr.id = pa.vrp_run_id
LEFT JOIN public.profiles p ON p.id = 
  COALESCE(iq.planned_by, NULLIF(vr.requested_by, '')::uuid);

GRANT SELECT ON public.inspections_with_planner TO authenticated;