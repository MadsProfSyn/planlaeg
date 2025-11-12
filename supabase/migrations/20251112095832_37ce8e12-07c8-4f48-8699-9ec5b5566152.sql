-- Drop the 3-parameter version of get_vrp_input to resolve function overloading
DROP FUNCTION IF EXISTS public.get_vrp_input(uuid[], date[], boolean);

-- Ensure the 2-parameter version exists with correct implementation
CREATE OR REPLACE FUNCTION public.get_vrp_input(p_inspection_ids uuid[], p_target_dates date[])
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
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
            iq.status
        FROM inspection_queue iq
        WHERE iq.id = ANY(p_inspection_ids)
          AND iq.status = 'PENDING'
          AND iq.preferred_date = ANY(p_target_dates)
    ),
    available_inspectors AS (
        SELECT 
            i.id as inspector_id,
            i.full_name,
            i.address as home_address,
            i.lat as home_lat,
            i.lng as home_lng,
            sa.date_local,
            sa.start_time_local,
            sa.end_time_local,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'inspection_type', isk.inspection_type
                    )
                ) FILTER (WHERE isk.inspection_type IS NOT NULL),
                '[]'::json
            ) as skills
        FROM inspectors i
        INNER JOIN supabase_availability sa 
            ON sa.inspector_id = i.id
            AND sa.is_available = true
            AND sa.date_local = ANY(p_target_dates)
        LEFT JOIN inspector_skills isk 
            ON isk.inspector_id = i.id
            AND isk.is_active = true
        WHERE i.is_active = true
          AND i.lat IS NOT NULL
          AND i.lng IS NOT NULL
        GROUP BY i.id, i.full_name, i.address, i.lat, i.lng, 
                 sa.date_local, sa.start_time_local, sa.end_time_local
    ),
    inspector_capacity AS (
        SELECT 
            icv.inspector_id,
            icv.inspector_name,
            icv.date_local::text as date_local,
            icv.start_time_local::text as start_time_local,
            icv.end_time_local::text as end_time_local,
            icv.total_minutes,
            icv.booked_minutes,
            icv.remaining_minutes,
            icv.capacity_status,
            icv.percent_booked,
            icv.shift_details,
            icv.shift_types
        FROM inspector_capacity_view icv
        WHERE 
            icv.date_local = ANY(p_target_dates)
            AND icv.is_available = true
            AND (icv.remaining_minutes IS NULL OR icv.remaining_minutes > 0)
            AND COALESCE(icv.capacity_status, 'available') != 'overbooked'
    ),
    existing_shifts AS (
        SELECT 
            ic.inspector_id,
            ic.date_local,
            (shift->>'start_time')::time as start_time,
            (shift->>'end_time')::time as end_time,
            shift->>'address' as address,
            shift->>'type' as shift_type,
            (shift->>'duration_minutes')::integer as duration_minutes
        FROM inspector_capacity ic,
        LATERAL jsonb_array_elements(ic.shift_details::jsonb) as shift
        WHERE ic.shift_details IS NOT NULL 
          AND jsonb_array_length(ic.shift_details::jsonb) > 0
    )
    SELECT json_build_object(
        'inspections', (SELECT json_agg(row_to_json(ti)) FROM target_inspections ti),
        'inspectors', (SELECT json_agg(row_to_json(ai)) FROM available_inspectors ai),
        'inspector_capacity', (SELECT json_agg(row_to_json(ic)) FROM inspector_capacity ic),
        'existing_shifts', (SELECT json_agg(row_to_json(es)) FROM existing_shifts es)
    ) INTO result;
    
    RETURN result;
END;
$function$;