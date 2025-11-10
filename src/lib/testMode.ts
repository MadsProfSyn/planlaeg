/**
 * TEST MODE Configuration
 * 
 * When TEST_MODE is true, only test inspectors will be used in VRP calculations
 * and manual assignments. This prevents accidentally posting shifts to production
 * inspectors in WorkFeed during testing.
 * 
 * Test Inspectors (marked with notes LIKE '%TEST USER%' in database):
 * - Albert Bisgaard (albert@profsyn.dk) - wf_employee_id: tUJvSyc62KzaMth3oFzf
 * - Mads Boye Nielsen (mads@profsyn.dk) - wf_employee_id: yu4GsjDkxANUl3w5rqgL
 * - Jobson De Souza (jobson@profsyn.dk) - wf_employee_id: iZOmCAs4BDdhxLdHDHq9
 * 
 * IMPORTANT: Set to false when going to production!
 */
export const TEST_MODE = true;

/**
 * Get filter for test mode
 * Returns SQL filter to restrict to test users only
 */
export function getTestModeFilter() {
  return TEST_MODE ? "notes LIKE '%TEST USER%'" : null;
}

/**
 * Apply test mode filter to a Supabase query
 */
export function applyTestModeFilter<T>(query: any): any {
  if (TEST_MODE) {
    return query.like("notes", "%TEST USER%");
  }
  return query;
}
