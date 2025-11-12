-- Drop and recreate inspector_capacity_view with proper time range handling
DROP VIEW IF EXISTS inspector_capacity_view;

CREATE OR REPLACE VIEW inspector_capacity_view AS
WITH availability_with_ranges AS (
  SELECT 
    a.inspector_id,
    a.inspector_name,
    a.date_local,
    a.is_available,
    a.department,
    -- Aggregate time ranges or use base availability times with fallback to defaults
    COALESCE(
      MIN(atr.start_time),
      a.start_time_local,
      '08:00'::time
    ) as start_time_local,
    COALESCE(
      MAX(atr.end_time),
      a.end_time_local,
      '16:00'::time
    ) as end_time_local
  FROM supabase_availability a
  LEFT JOIN availability_time_ranges atr 
    ON atr.availability_id = a.id
  GROUP BY 
    a.id,
    a.inspector_id,
    a.inspector_name,
    a.date_local,
    a.is_available,
    a.department,
    a.start_time_local,
    a.end_time_local
)
SELECT 
  awr.inspector_id,
  awr.inspector_name,
  awr.date_local,
  awr.start_time_local,
  awr.end_time_local,
  awr.is_available,
  awr.department,
  COALESCE(shifts.shift_count, 0) AS scheduled_shifts,
  COALESCE(shifts.total_minutes, 0) AS booked_minutes,
  COALESCE(shifts.shift_types, ARRAY[]::text[]) AS shift_types,
  COALESCE(shifts.shift_details, '[]'::json) AS shift_details,
  EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60 AS total_minutes,
  EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60 - 
    COALESCE(shifts.total_minutes, 0) AS remaining_minutes,
  CASE
    WHEN NOT awr.is_available THEN 'IKKE TILGÆNGELIG'
    WHEN COALESCE(shifts.total_minutes, 0) = 0 THEN 'LEDIG'
    WHEN COALESCE(shifts.total_minutes, 0)::numeric >= 
      ((EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 0.9) 
      THEN 'FULD DAG'
    WHEN COALESCE(shifts.total_minutes, 0)::numeric >= 
      ((EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 0.5) 
      THEN '50% BOOKET'
    ELSE 'DELVIST BOOKET'
  END AS capacity_status,
  CASE
    WHEN awr.is_available AND EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local) > 0 
      THEN round(COALESCE(shifts.total_minutes, 0)::numeric / 
        (EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 100)
    ELSE 0
  END AS percent_booked
FROM availability_with_ranges awr
LEFT JOIN (
  SELECT 
    inspector_id,
    date_local,
    count(*) AS shift_count,
    sum(duration_minutes) AS total_minutes,
    array_agg(DISTINCT type) AS shift_types,
    json_agg(
      json_build_object(
        'type', type,
        'start_time', start_time_local,
        'end_time', end_time_local,
        'duration_minutes', duration_minutes,
        'address', address,
        'status', status
      ) ORDER BY start_time_local
    ) AS shift_details
  FROM supabase_shifts
  WHERE status = ANY(ARRAY['ASSIGNED', 'RELEASED'])
  GROUP BY inspector_id, date_local
) shifts ON awr.inspector_id = shifts.inspector_id AND awr.date_local = shifts.date_local
WHERE awr.date_local >= CURRENT_DATE
ORDER BY awr.date_local, awr.inspector_name;