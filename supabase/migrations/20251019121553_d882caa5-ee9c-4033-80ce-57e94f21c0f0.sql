-- Update get_vrp_input to only include inspections with valid coordinates
CREATE OR REPLACE FUNCTION public.get_vrp_input(p_inspection_ids uuid[], p_target_dates date[])
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    result JSON;
BEGIN
    WITH target_inspections AS (
        SELECT 
            iq.id,
            iq.address,
            iq.inspection_type,
            iq.rooms,
            iq.preferred_date,
            iq.lat,
            iq.lng,
            itm.abbreviation as type_code,
            id_dur.minutes as duration_minutes
        FROM inspection_queue iq
        LEFT JOIN inspection_type_mappings itm ON itm.full_name = iq.inspection_type
        LEFT JOIN inspection_durations id_dur ON 
            id_dur.inspection_type::text = itm.abbreviation
            AND id_dur.rooms = iq.rooms
        WHERE iq.id = ANY(p_inspection_ids)
          AND iq.status = 'PENDING'
          AND iq.lat IS NOT NULL
          AND iq.lng IS NOT NULL
          AND iq.geocode_status = 'success'
    ),
    available_inspectors AS (
        SELECT 
            i.id as inspector_id,
            i.full_name,
            i.address as home_address,
            i.lat as home_lat,
            i.lng as home_lng,
            sa.date_local,
            sa.start_time_local::text as start_time_local,
            sa.end_time_local::text as end_time_local,
            ARRAY_AGG(DISTINCT isk.inspection_type) as can_do_types
        FROM inspectors i
        JOIN supabase_availability sa ON sa.inspector_id = i.id
        JOIN inspector_skills isk ON isk.inspector_id = i.id AND isk.is_active = true
        WHERE 
            sa.is_available = true
            AND sa.date_local = ANY(p_target_dates)
            AND i.is_active = true
            AND i.lat IS NOT NULL
        GROUP BY i.id, i.full_name, i.address, i.lat, i.lng, sa.date_local, sa.start_time_local, sa.end_time_local
    ),
    existing_shifts AS (
        SELECT 
            ss.inspector_id,
            ss.date_local,
            (ss.start_utc AT TIME ZONE 'Europe/Copenhagen')::time as start_time,
            (ss.end_utc AT TIME ZONE 'Europe/Copenhagen')::time as end_time,
            ss.address
        FROM supabase_shifts ss
        WHERE 
            ss.date_local = ANY(p_target_dates)
            AND ss.status != 'CANCELLED'
    )
    SELECT json_build_object(
        'inspections', (SELECT json_agg(row_to_json(ti)) FROM target_inspections ti),
        'inspectors', (SELECT json_agg(row_to_json(ai)) FROM available_inspectors ai),
        'existing_shifts', (SELECT json_agg(row_to_json(es)) FROM existing_shifts es)
    ) INTO result;
    
    RETURN result;
END;
$function$;