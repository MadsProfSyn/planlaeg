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
  debug?: any; // For debugging information
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

// ===== DEBUG FUNCTIONS =====

/**
 * Debug version of fetchWorkfeedShifts with detailed logging
 */
export async function debugFetchWorkfeedShifts(request: FetchShiftsRequest = {}): Promise<any> {
  try {
    console.log('Debug: Calling edge function with request:', request);
    
    const { data, error } = await supabase.functions.invoke('fetch-workfeed-shifts', {
      body: {
        startDate: request.startDate,
        endDate: request.endDate,
        employeeId: request.employeeId,
        department: request.department,
      },
    });

    console.log('Debug: Edge function response data:', data);
    console.log('Debug: Edge function response error:', error);

    if (error) {
      console.error('Debug: Supabase function error:', error);
      throw new Error(error.message || 'Failed to fetch shifts');
    }

    return data;
  } catch (error) {
    console.error('Debug: Full error details:', error);
    throw error;
  }
}

/**
 * Comprehensive test function to debug the entire flow
 */
export async function comprehensiveShiftsTest(): Promise<void> {
  console.log('=== COMPREHENSIVE SHIFTS TEST ===');
  console.log('Current time:', new Date().toISOString());
  
  try {
    // Test 1: Basic function call
    console.log('\nTest 1: Basic function call with date range');
    const testRequest = {
      startDate: '2025-09-22',
      endDate: '2025-09-26'
    };
    
    console.log('Sending request:', testRequest);
    
    const { data, error } = await supabase.functions.invoke('fetch-workfeed-shifts', {
      body: testRequest,
    });

    console.log('Raw response data:', data);
    console.log('Raw response error:', error);
    
    if (error) {
      console.error('Supabase function error:', error);
      return;
    }
    
    if (data) {
      console.log('Response received:', {
        success: data.success,
        total: data.total,
        shiftsCount: data.shifts?.length || 0,
        filters: data.filters,
        debug: data.debug
      });
      
      if (data.shifts && data.shifts.length > 0) {
        console.log('First shift sample:', data.shifts[0]);
        console.log('All shift dates:', data.shifts.map((s: any) => ({ 
          id: s.id, 
          date: s.date_local, 
          inspector: s.inspector_name,
          department: s.department,
          type: s.type
        })));
      } else {
        console.log('No shifts in response');
        if (data.message) {
          console.log('Message:', data.message);
        }
      }
    }

    // Test 2: Today's shifts
    console.log('\nTest 2: Today\'s shifts');
    const todayResult = await fetchTodayShifts();
    console.log('Today\'s shifts result:', {
      success: todayResult.success,
      total: todayResult.total,
      error: todayResult.error
    });

    // Test 3: Current week shifts
    console.log('\nTest 3: Current week shifts');
    const weekResult = await fetchCurrentWeekShifts();
    console.log('Current week shifts result:', {
      success: weekResult.success,
      total: weekResult.total,
      error: weekResult.error
    });

  } catch (error) {
    console.error('Test failed with error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Test with different date ranges
 */
export async function testDateRanges(): Promise<void> {
  console.log('=== TESTING DIFFERENT DATE RANGES ===');
  
  const testCases = [
    {
      name: 'Today only',
      ...DateRanges.today()
    },
    {
      name: 'Tomorrow only', 
      ...DateRanges.tomorrow()
    },
    {
      name: 'This week',
      ...DateRanges.thisWeek()
    },
    {
      name: 'Next 7 days',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  ];

  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`Date range: ${testCase.startDate} to ${testCase.endDate}`);
    
    try {
      const result = await fetchWorkfeedShifts({
        startDate: testCase.startDate,
        endDate: testCase.endDate
      });
      
      console.log(`${testCase.name}:`, {
        success: result.success,
        total: result.total,
        error: result.error
      });
      
      if (result.shifts?.length > 0) {
        console.log(`Sample shifts for ${testCase.name}:`, 
          result.shifts.slice(0, 2).map(s => ({
            date: s.date_local,
            inspector: s.inspector_name,
            department: s.department
          }))
        );
      }
    } catch (error) {
      console.error(`${testCase.name} failed:`, error.message);
    }
  }
}

/**
 * Check Supabase connection and tables
 */
export async function testSupabaseConnection(): Promise<void> {
  console.log('=== TESTING SUPABASE CONNECTION ===');
  
  try {
    // Test inspectors table
    console.log('Testing inspectors_import_staging table...');
    const { data: inspectors, error: inspectorsError } = await supabase
      .from('inspectors_import_staging')
      .select('wf_employee_id, full_name, department')
      .limit(5);
    
    if (inspectorsError) {
      console.error('Inspectors table error:', inspectorsError);
    } else {
      console.log('Inspectors sample:', inspectors);
    }

    // Test role mappings table
    console.log('Testing role_mappings table...');
    const { data: roleMappings, error: roleMappingsError } = await supabase
      .from('role_mappings')
      .select('wf_role_id, wf_role_name, role_id')
      .limit(5);
    
    if (roleMappingsError) {
      console.error('Role mappings table error:', roleMappingsError);
    } else {
      console.log('Role mappings sample:', roleMappings);
    }

  } catch (error) {
    console.error('Supabase connection test failed:', error);
  }
}

/**
 * Test function - call this from your component to debug
 */
export async function testShiftsFetch(): Promise<void> {
  console.log('=== Testing Shifts Fetch ===');
  
  try {
    const result = await debugFetchWorkfeedShifts({
      startDate: '2025-09-22',
      endDate: '2025-09-26'
    });
    
    console.log('Test result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

/**
 * Quick test function for specific employee IDs from your Postman data
 */
export async function testSpecificEmployeeMapping(): Promise<void> {
  console.log('=== TESTING SPECIFIC EMPLOYEE MAPPINGS ===');
  
  // Using the actual IDs from your Postman data
  const testEmployeeIds = ['PtKzJ5x4Cfeut4KOyDGy54dTImg1', 'tUJvSyc62KzaMth3oFzf', 'yu4GsjDkxANUl3w5rqgL'];
  const testRoleIds = ['ZfgNXIuTidlekazQJ8C8', 'kWUDQI8qFRsAkqRFBMPQ', 'lDPaGfi5087x1ncTKBZ0'];
  const testDepartmentIds = ['h6MIG7yBlbUxpLXjqnZv', 'tje1JXcx8V7DDlRR4PWY'];

  try {
    // Test employee mappings
    console.log('Testing employee mappings...');
    for (const employeeId of testEmployeeIds) {
      const { data, error } = await supabase
        .from('inspectors_import_staging')
        .select('wf_employee_id, full_name, department')
        .eq('wf_employee_id', employeeId);
      
      if (error) {
        console.log(`Employee ${employeeId} error:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Employee ${employeeId}:`, data[0]);
      } else {
        console.log(`Employee ${employeeId}: Not found`);
      }
    }

    // Test role mappings
    console.log('\nTesting role mappings...');
    for (const roleId of testRoleIds) {
      const { data, error } = await supabase
        .from('role_mappings')
        .select('wf_role_id, wf_role_name, role_id')
        .eq('wf_role_id', roleId);
      
      if (error) {
        console.log(`Role ${roleId} error:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Role ${roleId}:`, data[0]);
      } else {
        console.log(`Role ${roleId}: Not found`);
      }
    }

    // Test department mappings
    console.log('\nTesting department mappings...');
    for (const deptId of testDepartmentIds) {
      const { data, error } = await supabase
        .from('inspectors_import_staging')
        .select('wf_department_id_by_name, department')
        .eq('wf_department_id_by_name', deptId)
        .limit(1);
      
      if (error) {
        console.log(`Department ${deptId} error:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Department ${deptId}:`, data[0]);
      } else {
        console.log(`Department ${deptId}: Not found`);
      }
    }

  } catch (error) {
    console.error('Employee mapping test failed:', error);
  }
}

/**
 * Master test function - run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('=== RUNNING ALL WORKFEED TESTS ===\n');
  
  await testSupabaseConnection();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testSpecificEmployeeMapping();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await comprehensiveShiftsTest();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testDateRanges();
  
  console.log('\n=== ALL TESTS COMPLETED ===');
  console.log('Check the browser console and Supabase Edge Function logs for detailed information.');
}