import { supabase } from "@/integrations/supabase/client";

export interface WorkfeedShift {
  id: string;
  inspection_id: string | null;
  inspector_id: string;
  inspector_name: string;
  department: string;
  type: string;
  status: string;
  date_local: string;
  start_utc: string | null;
  end_utc: string | null;
  created_at?: string;
}

export interface FetchShiftsRequest {
  startDate?: string;
  endDate?: string;
  inspectorId?: string;
  department?: string;
}

export interface FetchShiftsResponse {
  success: boolean;
  shifts: WorkfeedShift[];
  total: number;
  filters: FetchShiftsRequest;
  error?: string;
}

/**
 * Fetches shifts from supabase_shifts table
 */
export async function fetchShifts(request: FetchShiftsRequest = {}): Promise<FetchShiftsResponse> {
  try {
    let query = supabase
      .from('supabase_shifts')
      .select('*')
      .order('date_local', { ascending: true });

    // Apply filters
    if (request.startDate) {
      query = query.gte('date_local', request.startDate);
    }
    
    if (request.endDate) {
      query = query.lte('date_local', request.endDate);
    }
    
    if (request.department) {
      query = query.eq('department', request.department);
    }
    
    if (request.inspectorId) {
      query = query.eq('inspector_id', request.inspectorId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || 'Failed to fetch shifts');
    }

    // Transform data to match WorkfeedShift interface
    const shifts = (data || []).map((shift: any) => ({
      id: shift.id,
      inspection_id: shift.inspection_id,
      inspector_id: shift.inspector_id,
      inspector_name: shift.inspector_name,
      department: shift.department,
      type: shift.type,
      status: shift.status,
      date_local: shift.date_local,
      start_utc: shift.start_utc,
      end_utc: shift.end_utc,
      created_at: shift.created_at,
    }));

    return {
      success: true,
      shifts,
      total: shifts.length,
      filters: request
    };
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return {
      success: false,
      shifts: [],
      total: 0,
      filters: request,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetches shifts for today
 */
export async function fetchTodayShifts(): Promise<FetchShiftsResponse> {
  const today = new Date().toISOString().split('T')[0];
  
  return fetchShifts({
    startDate: today,
    endDate: today
  });
}

/**
 * Fetches shifts for a date range
 */
export async function fetchShiftsByDateRange(from: Date, to: Date): Promise<FetchShiftsResponse> {
  return fetchShifts({
    startDate: from.toISOString().split('T')[0],
    endDate: to.toISOString().split('T')[0]
  });
}

/**
 * Helper function to format date for API calls
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Helper function to get date ranges
 */
export const DateRanges = {
  today: () => {
    const today = formatDateForAPI(new Date());
    return { startDate: today, endDate: today };
  },
  
  thisWeek: () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      startDate: formatDateForAPI(startOfWeek),
      endDate: formatDateForAPI(endOfWeek)
    };
  },
  
  next30Days: () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    return {
      startDate: formatDateForAPI(today),
      endDate: formatDateForAPI(endDate)
    };
  }
};