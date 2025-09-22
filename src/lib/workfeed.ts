import { supabase } from "@/integrations/supabase/client";

export interface WorkfeedShift {
  id: string;
  inspector_id: string;
  inspector_name: string;
  department: string;
  type: string;
  status: string;
  date_local: string;
  start_utc: string | null;
  end_utc: string | null;
  address?: string;
  wf_shift_id?: string;
  wf_role_id?: string;
  created_at?: string;
  inspection_id?: string | null;
}

export interface FetchShiftsRequest {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
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
export async function fetchWorkfeedShifts(request: FetchShiftsRequest = {}): Promise<FetchShiftsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-shifts', {
      body: request,
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch shifts');
    }

    return data as FetchShiftsResponse;
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
  
  return fetchWorkfeedShifts({
    startDate: today,
    endDate: today
  });
}

/**
 * Fetches shifts for a date range
 */
export async function fetchShiftsByDateRange(from: Date, to: Date): Promise<FetchShiftsResponse> {
  return fetchWorkfeedShifts({
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