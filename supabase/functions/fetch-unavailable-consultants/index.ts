import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaff } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  date: string; // ISO date string (YYYY-MM-DD)
  search?: string;
  skills?: string[];
  showAvailable?: boolean;
  showUnavailable?: boolean;
  departments?: string[];
  page?: number;
  pageSize?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: RequestBody = await req.json();
    const {
      date,
      search = "",
      skills = [],
      showAvailable = true,
      showUnavailable = true,
      departments = [],
      page = 1,
      pageSize = 50,
    } = body;
    
    const offset = (page - 1) * pageSize;

    console.log("Fetching unavailable consultants for:", {
      date,
      search,
      skills,
      showAvailable,
      showUnavailable,
      departments,
      page,
      pageSize,
    });

    // Build the SQL query
    const query = `
      WITH consultant_skills AS (
        SELECT 
          inspector_id,
          array_agg(DISTINCT inspection_type) as skills
        FROM inspector_skills
        WHERE is_active = true
        GROUP BY inspector_id
      ),
      booked_shifts AS (
        SELECT 
          inspector_id,
          COUNT(*) as shift_count
        FROM supabase_shifts
        WHERE date_local = $1
        AND status IN ('ASSIGNED', 'booked')
        GROUP BY inspector_id
      ),
      time_ranges AS (
        SELECT 
          sa.id as availability_id,
          json_agg(
            json_build_object(
              'start_time', atr.start_time::text,
              'end_time', atr.end_time::text
            ) ORDER BY atr.start_time
          ) as ranges
        FROM supabase_availability sa
        INNER JOIN availability_time_ranges atr ON atr.availability_id = sa.id
        WHERE sa.date_local = $1
        GROUP BY sa.id
      )
      SELECT 
        i.id as inspector_id,
        i.full_name,
        i.email,
        d.name as department,
        COALESCE(cs.skills, ARRAY[]::text[]) as skills,
        CASE 
          WHEN sa.is_available IS NULL THEN 'no_record'
          WHEN sa.is_available = true THEN 'available'
          ELSE 'unavailable'
        END as availability_status,
        sa.id as availability_id,
        sa.source,
        tr.ranges as time_ranges,
        COALESCE(bs.shift_count, 0) as booked_shifts_count
      FROM inspectors i
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN consultant_skills cs ON cs.inspector_id = i.id
      LEFT JOIN supabase_availability sa ON sa.inspector_id = i.id AND sa.date_local = $1
      LEFT JOIN time_ranges tr ON tr.availability_id = sa.id
      LEFT JOIN booked_shifts bs ON bs.inspector_id = i.id
      WHERE i.is_active = true
      ORDER BY i.full_name
    `;

    const { data: consultants, error } = await supabase.rpc("exec_sql", {
      sql: query,
      params: [date],
    });

    if (error) {
      console.error("Database error:", error);
      
      // Fallback: use direct table queries
      const { data: inspectors, error: inspectorsError } = await supabase
        .from("inspectors")
        .select(`
          id,
          full_name,
          email,
          department_id,
          departments (
            name
          )
        `)
        .eq("is_active", true)
        .order("full_name");

      if (inspectorsError) {
        throw inspectorsError;
      }

      // Fetch availability for the date
      const { data: availability, error: availError } = await supabase
        .from("supabase_availability")
        .select("*")
        .eq("date_local", date);

      if (availError) {
        throw availError;
      }

      // Fetch time ranges
      const availabilityIds = availability?.map(a => a.id) || [];
      const { data: timeRanges, error: timeRangesError } = await supabase
        .from("availability_time_ranges")
        .select("*")
        .in("availability_id", availabilityIds);

      if (timeRangesError) {
        throw timeRangesError;
      }

      // Group time ranges by availability_id
      const rangesByAvailability = timeRanges?.reduce((acc, tr) => {
        if (!acc[tr.availability_id]) acc[tr.availability_id] = [];
        acc[tr.availability_id].push({
          start_time: tr.start_time,
          end_time: tr.end_time
        });
        return acc;
      }, {} as Record<string, any[]>) || {};

      // Fetch skills
      const { data: skillsData, error: skillsError } = await supabase
        .from("inspector_skills")
        .select("inspector_id, inspection_type")
        .eq("is_active", true);

      if (skillsError) {
        throw skillsError;
      }

      // Fetch booked shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("supabase_shifts")
        .select("inspector_id")
        .eq("date_local", date)
        .in("status", ["ASSIGNED", "booked"]);

      if (shiftsError) {
        throw shiftsError;
      }

      // Combine the data
      const skillsByInspector = skillsData?.reduce((acc, s) => {
        if (!acc[s.inspector_id]) acc[s.inspector_id] = [];
        acc[s.inspector_id].push(s.inspection_type);
        return acc;
      }, {} as Record<string, string[]>) || {};

      const shiftsByInspector = shiftsData?.reduce((acc, s) => {
        acc[s.inspector_id] = (acc[s.inspector_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const availByInspector = availability?.reduce((acc, a) => {
        acc[a.inspector_id] = a;
        return acc;
      }, {} as Record<string, any>) || {};

      const combined = inspectors?.map((i: any) => {
        const avail = availByInspector[i.id];
        return {
          inspector_id: i.id,
          full_name: i.full_name,
          email: i.email,
          department: i.departments?.name || null,
          skills: skillsByInspector[i.id] || [],
          availability_status: avail?.is_available === null || avail?.is_available === undefined
            ? "no_record"
            : avail.is_available
            ? "available"
            : "unavailable",
          availability_id: avail?.id || null,
          source: avail?.source || null,
          time_ranges: avail ? (rangesByAvailability[avail.id] || null) : null,
          booked_shifts_count: shiftsByInspector[i.id] || 0,
        };
      }) || [];

      // Apply filters
      let filtered = combined;

      // Name search
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((c: any) =>
          c.full_name.toLowerCase().includes(searchLower)
        );
      }

      // Skills filter
      if (skills.length > 0) {
        filtered = filtered.filter((c: any) =>
          skills.some((skill) => c.skills.includes(skill))
        );
      }

      // Availability toggles
      if (!showAvailable || !showUnavailable) {
        filtered = filtered.filter((c: any) => {
          if (showAvailable && c.availability_status === "available") return true;
          if (showUnavailable && (c.availability_status === "unavailable" || c.availability_status === "no_record")) return true;
          return false;
        });
      }

      // Department filter
      if (departments.length > 0) {
        filtered = filtered.filter((c: any) =>
          c.department && departments.includes(c.department)
        );
      }

      console.log(`Found ${filtered.length} consultants after filtering`);
      
      const totalCount = filtered.length;
      const paginatedData = filtered.slice(offset, offset + pageSize);
      const hasMore = offset + pageSize < totalCount;

      return new Response(JSON.stringify({ 
        consultants: paginatedData, 
        count: paginatedData.length,
        total: totalCount,
        hasMore,
        page,
        pageSize
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply filters on the result
    let filtered = consultants || [];

    // Name search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.full_name.toLowerCase().includes(searchLower)
      );
    }

    // Skills filter
    if (skills.length > 0) {
      filtered = filtered.filter((c: any) =>
        skills.some((skill) => c.skills.includes(skill))
      );
    }

    // Availability toggles
    if (!showAvailable || !showUnavailable) {
      filtered = filtered.filter((c: any) => {
        if (showAvailable && c.availability_status === "available") return true;
        if (showUnavailable && (c.availability_status === "unavailable" || c.availability_status === "no_record")) return true;
        return false;
      });
    }

    // Department filter
    if (departments.length > 0) {
      filtered = filtered.filter((c: any) =>
        c.department && departments.includes(c.department)
      );
    }

    console.log(`Returning ${filtered.length} consultants (total before pagination)`);
    
    const totalCount = filtered.length;
    const paginatedData = filtered.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < totalCount;

    return new Response(
      JSON.stringify({ 
        consultants: paginatedData, 
        count: paginatedData.length,
        total: totalCount,
        hasMore,
        page,
        pageSize
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching consultants:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
