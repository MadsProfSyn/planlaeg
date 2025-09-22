-- Create the v_available_inspectors view that combines availability with inspector metadata and skills
CREATE OR REPLACE VIEW public.v_available_inspectors AS
SELECT
  sa.id                                 AS availability_id,
  sa.inspector_id                        AS inspector_uuid,
  COALESCE(i.full_name, sa.inspector_name)                AS navn,
  COALESCE(i.department, sis.department, 'Ukendt')        AS afdeling,
  COALESCE(
    (SELECT array_agg(DISTINCT sk.inspection_type::text ORDER BY 1)
       FROM public.inspector_skills sk
       WHERE i.id IS NOT NULL AND sk.inspector_id = i.id),
    i.capabilities,  -- already text[]
    NULLIF(regexp_split_to_array(regexp_replace(COALESCE(sis.types_csv,''), '\s+', '', 'g'), ','), ARRAY['']::text[]),
    ARRAY['Proforma','Projektsyn','Indflytningssyn','Fraflytningssyn']::text[]
  )                                                    AS synstyper,
  COALESCE(i.start_address, sis.address, '')           AS adresse,
  sa.date_local                                        AS dato,
  NULL::time                                           AS start_tid,
  NULL::time                                           AS slut_tid,
  CASE WHEN sa.is_available THEN 'All Day' ELSE 'Ikke tilgængelig' END AS tidspunkt_label
FROM public.supabase_availability sa
LEFT JOIN public.inspectors_import_staging sis
  ON sis.wf_employee_id = sa.inspector_id::text
LEFT JOIN public.inspectors i
  ON i.email = sis.email
WHERE sa.is_available IS TRUE;