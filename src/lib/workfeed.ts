import { supabase } from "@/integrations/supabase/client";

export interface SyncShiftsRequest {
  startFrom: string;  // ISO datetime string like "2025-09-22T00:00:00.000Z"
  startTo: string;    // ISO datetime string like "2025-09-26T23:59:59.999Z"
}

export interface SyncShiftsResponse {
  success: boolean;
  message: string;
  shifts: number;
  error?: string;
}

/**
 * Syncs shifts from Workfeed API to Supabase database
 * @param request - The date range to sync shifts for
 * @returns Promise with sync results
 */
export async function syncWorkfeedShifts(request: SyncShiftsRequest): Promise<SyncShiftsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-workfeed-shifts', {
      body: request
    });

    if (error) {
      throw new Error(error.message || 'Failed to invoke sync function');
    }

    return data as SyncShiftsResponse;
  } catch (error) {
    console.error('Error syncing Workfeed shifts:', error);
    return {
      success: false,
      message: 'Failed to sync shifts',
      shifts: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to create date range for today
 */
export function getTodayDateRange(): SyncShiftsRequest {
  const today = new Date();
  const startFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endTo = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
  
  return {
    startFrom,
    startTo: endTo
  };
}

/**
 * Helper function to create date range for a specific date range
 */
export function getDateRange(from: Date, to: Date): SyncShiftsRequest {
  const startFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString();
  const endTo = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).toISOString();
  
  return {
    startFrom,
    startTo: endTo
  };
}

/**
 * Helper function to sync shifts for the current week
 */
export async function syncCurrentWeekShifts(): Promise<SyncShiftsResponse> {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday
  
  return syncWorkfeedShifts(getDateRange(startOfWeek, endOfWeek));
}