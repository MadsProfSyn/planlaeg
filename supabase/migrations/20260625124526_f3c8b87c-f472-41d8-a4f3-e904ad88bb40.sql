ALTER TABLE public.supabase_shifts
  ADD COLUMN IF NOT EXISTS geocode_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS supabase_shifts_geocode_status_idx
  ON public.supabase_shifts (geocode_status);

-- Mark existing rows according to current lat/lng state so the new column is meaningful
UPDATE public.supabase_shifts
   SET geocode_status = CASE
     WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 'success'
     WHEN address IS NULL OR address = '' THEN 'no_address'
     ELSE 'pending'
   END
 WHERE geocode_status = 'pending';