
CREATE OR REPLACE FUNCTION public.normalize_dk_address(addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(
    regexp_replace(
      regexp_replace(
        COALESCE(addr, ''),
        ',\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(,|$)',
        '\3',
        'gi'
      ),
      '\s{2,}', ' ', 'g'
    )
  )) || ', danmark'
$$;
