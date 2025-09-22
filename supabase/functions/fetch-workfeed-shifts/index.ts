import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkfeedShift {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  roleId: string;
  roleName: string;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  comment?: string;
  [key: string]: any;
}

interface TransformedShift {
  id: string;
  inspector_id: string;
  inspector_name: string;
  department: string;
  type: string;
  status: string;
  date_local: string;
  start_utc: string | null;
  end_utc: string | null;
  address: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const workfeedApiKey = Deno.env.get('WORKFEED_API_KEY');
    if (!workfeedApiKey) {
      throw new Error('WORKFEED_API_KEY not configured');
    }

    // Parse query parameters
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const employeeId = url.searchParams.get('employeeId');
    const department = url.searchParams.get('department');

    // Default to today if no start date provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startFrom = startDate 
      ? new Date(startDate).toISOString() 
      : today.toISOString();

    // Default to 30 days from start date if no end date provided
    const defaultEndDate = new Date(startFrom);
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);
    
    const startTo = endDate 
      ? new Date(endDate).toISOString() 
      : defaultEndDate.toISOString();

    console.log(`Fetching shifts from ${startFrom} to ${startTo}`);

    // Build Workfeed API URL
    let workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/KASqUqisoJTrzapASxwG/shifts?startFrom=${encodeURIComponent(startFrom)}&startTo=${encodeURIComponent(startTo)}`;
    
    // Add employee filter if provided
    if (employeeId) {
      workfeedUrl += `&employeeId=${encodeURIComponent(employeeId)}`;
    }

    // Fetch from Workfeed
    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workfeedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      console.error('Workfeed API error:', workfeedResponse.status, errorText);
      throw new Error(`Workfeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedShifts: WorkfeedShift[] = await workfeedResponse.json();
    console.log(`Received ${workfeedShifts.length} shifts from Workfeed`);

    // Filter to only current and future shifts
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const filteredShifts = workfeedShifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      shiftDate.setHours(0, 0, 0, 0);
      return shiftDate >= now; // Only today and future dates
    });

    // Transform shifts to your format
    const transformedShifts: TransformedShift[] = filteredShifts
      .map(shift => {
        try {
          // Extract address from comment (first line)
          const address = shift.comment?.split('\n')[0]?.trim() || '';
          
          // Convert times to proper format
          const startUtc = shift.startTime ? new Date(shift.startTime).toISOString() : null;
          const endUtc = shift.endTime ? new Date(shift.endTime).toISOString() : null;
          
          // Convert date to local date format (YYYY-MM-DD)
          const dateLocal = new Date(shift.date).toISOString().split('T')[0];

          return {
            id: shift.id,
            inspector_id: shift.employeeId,
            inspector_name: shift.employeeName,
            department: shift.departmentName,
            type: shift.roleName,
            status: mapWorkfeedStatus(shift.status),
            date_local: dateLocal,
            start_utc: startUtc,
            end_utc: endUtc,
            address: address,
          };
        } catch (error) {
          console.warn(`Failed to transform shift ${shift.id}:`, error);
          return null;
        }
      })
      .filter(shift => shift !== null) as TransformedShift[];

    // Apply additional filters
    let finalShifts = transformedShifts;

    if (department) {
      finalShifts = finalShifts.filter(shift => 
        shift.department.toLowerCase().includes(department.toLowerCase())
      );
    }

    // Sort by date and time
    finalShifts.sort((a, b) => {
      const dateComparison = a.date_local.localeCompare(b.date_local);
      if (dateComparison !== 0) return dateComparison;
      
      // If same date, sort by start time
      if (a.start_utc && b.start_utc) {
        return a.start_utc.localeCompare(b.start_utc);
      }
      return 0;
    });

    console.log(`Returning ${finalShifts.length} filtered shifts`);

    return new Response(JSON.stringify({
      success: true,
      shifts: finalShifts,
      total: finalShifts.length,
      filters: {
        startDate: startFrom,
        endDate: startTo,
        employeeId,
        department
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-shifts function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map Workfeed status to standard status
function mapWorkfeedStatus(workfeedStatus: string): string {
  switch (workfeedStatus?.toLowerCase()) {
    case 'assigned':
    case 'scheduled':
      return 'ASSIGNED';
    case 'completed':
    case 'done':
      return 'DONE';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'ASSIGNED';
  }
}