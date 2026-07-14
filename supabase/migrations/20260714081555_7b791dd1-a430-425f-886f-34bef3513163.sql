CREATE OR REPLACE VIEW public.inspector_capacity_view AS
WITH availability_with_ranges AS (
  SELECT a.inspector_id,
    a.inspector_name,
    a.date_local,
    a.is_available,
    a.department,
    COALESCE(min(atr.start_time), a.start_time_local, '08:00:00'::time) AS start_time_local,
    COALESCE(max(atr.end_time), a.end_time_local, '16:00:00'::time) AS end_time_local
  FROM supabase_availability a
    LEFT JOIN availability_time_ranges atr ON atr.availability_id = a.id
  GROUP BY a.id, a.inspector_id, a.inspector_name, a.date_local, a.is_available, a.department, a.start_time_local, a.end_time_local
)
SELECT awr.inspector_id,
  awr.inspector_name,
  awr.date_local,
  awr.start_time_local,
  awr.end_time_local,
  awr.is_available,
  awr.department,
  COALESCE(shifts.shift_count, 0::bigint) AS scheduled_shifts,
  COALESCE(shifts.total_minutes, 0::bigint) AS booked_minutes,
  COALESCE(shifts.shift_types, ARRAY[]::text[]) AS shift_types,
  COALESCE(shifts.shift_details, '[]'::json) AS shift_details,
  EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60 AS total_minutes,
  EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60 - COALESCE(shifts.total_minutes, 0::bigint) AS remaining_minutes,
  CASE
    WHEN NOT awr.is_available THEN 'IKKE TILGÆNGELIG'::text
    WHEN COALESCE(shifts.total_minutes, 0::bigint) = 0 THEN 'LEDIG'::text
    WHEN COALESCE(shifts.total_minutes, 0::bigint)::numeric >= ((EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 0.9) THEN 'FULD DAG'::text
    WHEN COALESCE(shifts.total_minutes, 0::bigint)::numeric >= ((EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 0.5) THEN '50% BOOKET'::text
    ELSE 'DELVIST BOOKET'::text
  END AS capacity_status,
  CASE
    WHEN awr.is_available AND EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local) > 0::numeric
      THEN round(COALESCE(shifts.total_minutes, 0::bigint)::numeric / (EXTRACT(epoch FROM awr.end_time_local - awr.start_time_local)::integer / 60)::numeric * 100::numeric)
    ELSE 0::numeric
  END AS percent_booked
FROM availability_with_ranges awr
  LEFT JOIN (
    SELECT ss.inspector_id,
      ss.date_local,
      count(*) AS shift_count,
      sum(ss.duration_minutes) AS total_minutes,
      array_agg(DISTINCT ss.type) AS shift_types,
      json_agg(
        json_build_object(
          'type', ss.type,
          'start_time', ss.start_time_local,
          'end_time', ss.end_time_local,
          'duration_minutes', ss.duration_minutes,
          'address', ss.address,
          'status', ss.status,
          'lat', mcc.lat,
          'lng', mcc.lon
        ) ORDER BY ss.start_time_local
      ) AS shift_details
    FROM supabase_shifts ss
      LEFT JOIN mapbox_coords_cache mcc
        ON mcc.normalized_address = public.normalize_dk_address(ss.address)
    WHERE ss.status = ANY (ARRAY['ASSIGNED'::text, 'RELEASED'::text])
    GROUP BY ss.inspector_id, ss.date_local
  ) shifts ON awr.inspector_id = shifts.inspector_id AND awr.date_local = shifts.date_local
WHERE awr.date_local >= CURRENT_DATE
ORDER BY awr.date_local, awr.inspector_name;