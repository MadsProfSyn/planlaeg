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
  wf_shift_id: string | null;
}

export interface SyncShiftsRequest {
  startDate?: string;    // ISO date string like "2025-09-22"
  endDate?: string;      // ISO date string like "2025-09-26"
  forceSync?: boolean;   // Whether to re-sync existing shifts
}

export interface FetchShiftsRequest {
  startDate?: string;    // ISO date string like "2025-09-22"
  endDate?: string;      // ISO date string like "2025-09-26"
  department?: string;   // Filter by department
  inspectorId?: string;  // Filter by inspector
  status?: string;       // Filter by status
}

export interface SyncShiftsResponse {
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  total: number;
  dateRange: {
    from: string;
    to: string;
  };
  summary: string;
  error?: string;
}

export interface FetchShiftsResponse {
  success: boolean;
  shifts: WorkfeedShift[];
  total: number;
  filters: FetchShiftsRequest;
  error?: string;
}

// ===== SYNC FUNCTIONS =====

/**
 * Syncs shifts from Workfeed API to Supabase
 */
export async function syncWorkfeedShifts(request: SyncShiftsRequest = {}): Promise<SyncShiftsResponse> {
  try {
    console.log('Syncing shifts with request:', request);
    
    const { data, error } = await supabase.functions.invoke('sync-workfeed-shifts', {
      body: request
    });

    if (error) {
      throw new Error(error.message || 'Failed to sync shifts');
    }

    return data as SyncShiftsResponse;
  } catch (error) {
    console.error('Error syncing Workfeed shifts:', error);
    return {
      success: false,
      synced: 0,
      skipped: 0,
      errors: 1,
      total: 0,
      dateRange: { from: '', to: '' },
      summary: 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Syncs today's shifts
 */
export async function syncTodayShifts(forceSync = false): Promise<SyncShiftsResponse> {
  const today = new Date().toISOString().split('T')[0];
  
  return syncWorkfeedShifts({
    startDate: today,
    endDate: today,
    forceSync
  });
}

/**
 * Syncs shifts for the next N days
 */
export async function syncUpcomingShifts(days: number = 7, forceSync = false): Promise<SyncShiftsResponse> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + days);
  
  return syncWorkfeedShifts({
    startDate: today.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    forceSync
  });
}

// ===== FETCH FUNCTIONS (from stored data) =====

/**
 * Fetches shifts from Supabase (stored data)
 */
export async function fetchStoredShifts(request: FetchShiftsRequest = {}): Promise<FetchShiftsResponse> {
  try {
    let query = supabase
      .from('supabase_shifts')
      .select('id, inspector_id, inspector_name, department, type, status, date_local, start_utc, end_utc, wf_shift_id')
      .order('date_local', { ascending: true })
      .order('start_utc', { ascending: true });

    // Apply filters
    if (request.startDate) {
      query = query.gte('date_local', request.startDate);
    }
    
    if (request.endDate) {
      query = query.lte('date_local', request.endDate);
    }
    
    if (request.department) {
      query = query.ilike('department', `%${request.department}%`);
    }
    
    if (request.inspectorId) {
      query = query.eq('inspector_id', request.inspectorId);
    }
    
    if (request.status) {
      query = query.eq('status', request.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      shifts: data as unknown as WorkfeedShift[],
      total: data?.length || 0,
      filters: request
    };

  } catch (error) {
    console.error('Error fetching stored shifts:', error);
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
 * Fetches today's shifts from stored data
 */
export async function fetchTodayShifts(): Promise<FetchShiftsResponse> {
  const today = new Date().toISOString().split('T')[0];
  
  return fetchStoredShifts({
    startDate: today,
    endDate: today
  });
}

/**
 * Fetches shifts for the current week from stored data
 */
export async function fetchCurrentWeekShifts(): Promise<FetchShiftsResponse> {
  const today = new Date();
  const startOfWeek = new Date(today);
  
  // Get Monday of current week
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  return fetchStoredShifts({
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0]
  });
}

/**
 * Fetches upcoming shifts (next N days) from stored data
 */
export async function fetchUpcomingShifts(days: number = 7): Promise<FetchShiftsResponse> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + days);
  
  return fetchStoredShifts({
    startDate: today.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  });
}

/**
 * Fetches shifts by department from stored data
 */
export async function fetchShiftsByDepartment(department: string, startDate?: string, endDate?: string): Promise<FetchShiftsResponse> {
  return fetchStoredShifts({
    department,
    startDate,
    endDate
  });
}

/**
 * Fetches shifts by inspector from stored data
 */
export async function fetchShiftsByInspector(inspectorId: string, startDate?: string, endDate?: string): Promise<FetchShiftsResponse> {
  return fetchStoredShifts({
    inspectorId,
    startDate,
    endDate
  });
}

// ===== UTILITY FUNCTIONS =====

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

// ===== COMBINED FUNCTIONS (sync + fetch) =====

/**
 * Ensures shifts are synced for a date range, then fetches them
 */
export async function ensureAndFetchShifts(request: FetchShiftsRequest & { forceSync?: boolean } = {}): Promise<{
  syncResult: SyncShiftsResponse;
  shifts: FetchShiftsResponse;
}> {
  // First sync the data
  const syncResult = await syncWorkfeedShifts({
    startDate: request.startDate,
    endDate: request.endDate,
    forceSync: request.forceSync
  });
  
  // Then fetch the stored data
  const shifts = await fetchStoredShifts(request);
  
  return { syncResult, shifts };
}

/**
 * Get shifts for today (sync first, then fetch)
 */
export async function getTodayShifts(): Promise<FetchShiftsResponse> {
  const { shifts } = await ensureAndFetchShifts(DateRanges.today());
  return shifts;
}

/**
 * Get shifts for current week (sync first, then fetch)
 */
export async function getCurrentWeekShifts(): Promise<FetchShiftsResponse> {
  const { shifts } = await ensureAndFetchShifts(DateRanges.thisWeek());
  return shifts;
}

// ===== DEBUG/TEST FUNCTIONS =====

/**
 * Test the sync functionality
 */
export async function testSyncShifts(): Promise<void> {
  console.log('=== TESTING SYNC FUNCTIONALITY ===');
  
  try {
    // Test syncing specific date range (your Postman dates)
    const syncResult = await syncWorkfeedShifts({
      startDate: '2025-09-22',
      endDate: '2025-09-26',
      forceSync: false
    });
    
    console.log('Sync result:', syncResult);
    
    if (syncResult.success) {
      // Now fetch the synced data
      const fetchResult = await fetchStoredShifts({
        startDate: '2025-09-22',
        endDate: '2025-09-26'
      });
      
      console.log('Fetch result:', fetchResult);
      
      if (fetchResult.shifts.length > 0) {
        console.log('Sample shift:', fetchResult.shifts[0]);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

/**
 * Check what shifts are currently in the database
 */
export async function checkStoredShifts(): Promise<void> {
  console.log('=== CHECKING STORED SHIFTS ===');
  
  try {
    const { data: shifts, error } = await supabase
      .from('supabase_shifts')
      .select('id, wf_shift_id, inspector_name, department, date_local, status')
      .order('date_local', { ascending: true })
      .limit(10);
    
    if (error) {
      console.error('Error checking stored shifts:', error);
      return;
    }
    
    console.log(`Found ${shifts?.length || 0} stored shifts (showing first 10):`);
    console.table(shifts);
    
  } catch (error) {
    console.error('Check failed:', error);
  }
}