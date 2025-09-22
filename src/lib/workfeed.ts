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
  address: string;
}

export interface FetchShiftsRequest {
  startDate?: string;    // ISO date string like "2025-09-22"
  endDate?: string;      // ISO date string like "2025-09-26"
  employeeId?: string;   // Filter by specific employee
  department?: string;   // Filter by department
}

export interface FetchShiftsResponse {
  success: boolean;
  shifts: WorkfeedShift[];
  total: number;
  filters: {
    startDate: string;
    endDate: string;
    employeeId?: string;
    department?: string;
  };
  error?: string;
}

/**
 * Fetches current and future shifts from Workfeed API
 * @param request - Optional filters for the shifts
 * @returns Promise with shift data
 */
export async function fetchWorkfeedShifts(request: FetchShiftsRequest = {}): Promise<FetchShiftsResponse> {
  try {
    // For edge functions, we pass parameters in the body, not as query params
    const { data, error } = await supabase.functions.invoke('fetch-workfeed-shifts', {
      body: {
        startDate: request.startDate,
        endDate: request.endDate,
        employeeId: request.employeeId,
        department: request.department,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch shifts');
    }

    return data as FetchShiftsResponse;
  } catch (error) {
    console.error('Error fetching Workfeed shifts:', error);
    return {
      success: false,
      shifts: [],
      total: 0,
      filters: {
        startDate: request.startDate || '',
        endDate: request.endDate || '',
        employeeId: request.employeeId,
        department: request.department
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetches all shifts for today
 */
export async function fetchTodayShifts(): Promise<FetchShiftsResponse> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  return fetchWorkfeedShifts({
    startDate: today,
    endDate: today
  });
}

/**
 * Fetches shifts for the current week (Monday to Sunday)
 */
export async function fetchCurrentWeekShifts(): Promise<FetchShiftsResponse> {
  const today = new Date();
  const startOfWeek = new Date(today);
  
  // Get Monday (1) of current week
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  
  return fetchWorkfeedShifts({
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0]
  });
}

/**
 * Fetches shifts for a specific date range
 */
export async function fetchShiftsByDateRange(from: Date, to: Date): Promise<FetchShiftsResponse> {
  return fetchWorkfeedShifts({
    startDate: from.toISOString().split('T')[0],
    endDate: to.toISOString().split('T')[0]
  });
}

/**
 * Fetches shifts for a specific employee
 */
export async function fetchShiftsByEmployee(employeeId: string, startDate?: string, endDate?: string): Promise<FetchShiftsResponse> {
  return fetchWorkfeedShifts({
    employeeId,
    startDate,
    endDate
  });
}

/**
 * Fetches shifts for a specific department
 */
export async function fetchShiftsByDepartment(department: string, startDate?: string, endDate?: string): Promise<FetchShiftsResponse> {
  return fetchWorkfeedShifts({
    department,
    startDate,
    endDate
  });
}

/**
 * Fetches shifts for the next N days
 */
export async function fetchUpcomingShifts(days: number = 7): Promise<FetchShiftsResponse> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + days);
  
  return fetchWorkfeedShifts({
    startDate: today.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
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
  
  tomorrow: () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = formatDateForAPI(tomorrow);
    return { startDate: date, endDate: date };
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
  
  nextWeek: () => {
    const today = new Date();
    const startOfNextWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + 7;
    startOfNextWeek.setDate(diff);
    
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
    
    return {
      startDate: formatDateForAPI(startOfNextWeek),
      endDate: formatDateForAPI(endOfNextWeek)
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