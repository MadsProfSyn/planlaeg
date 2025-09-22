import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface Shift {
  id: string;
  wf_shift_id: string;
  wf_role_id: string;
  start_utc: string | null;
  end_utc: string | null;
  date_local: string;
  inspector_name: string;
  department: string;
  type: string;
  status: string;
  created_at: string;
  inspection_id?: string | null;
  inspector_id?: string | null;
}

export interface ShiftFilters {
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  synsTypes?: string[];
  globalSearch?: string;
}

export interface PaginatedShiftsResponse {
  data: Shift[];
  count: number;
  totalPages: number;
  currentPage: number;
}

const CANONICAL_ROLES = ['PA', 'PS', 'IF', 'FF'];
const ROLE_LABELS: Record<string, string> = {
  'PA': 'Proforma',
  'PS': 'Projektsyn', 
  'IF': 'Indflytningssyn',
  'FF': 'Fraflytningssyn'
};

export async function getShifts(
  page: number = 1,
  pageSize: number = 25,
  filters: ShiftFilters = {}
): Promise<PaginatedShiftsResponse> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("supabase_shifts")
    .select("*", { count: "exact" });

  // Apply filters
  if (filters.department) {
    query = query.eq("department", filters.department);
  }

  if (filters.dateFrom) {
    query = query.gte("date_local", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("date_local", filters.dateTo);
  }

  // Order by date_local, then created_at for consistent pagination
  query = query
    .order("date_local", { ascending: true })
    .order("created_at", { ascending: true })
    .range(start, end);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch shifts: ${error.message}`);
  }

  let shifts = (data || []) as Shift[];

  // Apply client-side filters for synsTypes and global search
  if (filters.synsTypes && filters.synsTypes.length > 0) {
    // Simple type filtering based on the type field or wf_role_id
    shifts = shifts.filter(shift => 
      filters.synsTypes!.some(synsType => 
        shift.type?.includes(synsType) || shift.wf_role_id?.includes(synsType.toLowerCase())
      )
    );
  }

  if (filters.globalSearch && filters.globalSearch.trim()) {
    const search = filters.globalSearch.toLowerCase().trim();
    shifts = shifts.filter(shift => 
      shift.inspector_name?.toLowerCase().includes(search) ||
      shift.department?.toLowerCase().includes(search) ||
      shift.type?.toLowerCase().includes(search)
    );
  }

  const totalPages = Math.ceil((count || 0) / pageSize);

  return {
    data: shifts,
    count: count || 0,
    totalPages,
    currentPage: page,
  };
}

export async function getShiftDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from("supabase_shifts")
    .select("department");

  if (error) {
    throw new Error(`Failed to fetch departments: ${error.message}`);
  }

  // Get unique departments
  const departments = Array.from(
    new Set(data?.map((item) => item.department) || [])
  ).sort();

  return departments;
}

export function formatShiftTime(startUtc: string | null, endUtc: string | null): string {
  if (!startUtc || !endUtc) {
    return "All Day";
  }

  try {
    const startDate = toZonedTime(parseISO(startUtc), "Europe/Copenhagen");
    const endDate = toZonedTime(parseISO(endUtc), "Europe/Copenhagen");
    
    const startTime = format(startDate, "HH:mm");
    const endTime = format(endDate, "HH:mm");
    
    return `${startTime}–${endTime}`;
  } catch (error) {
    console.error("Failed to format shift time:", error);
    return "All Day";
  }
}

export function getRoleLabel(typeOrRoleId: string): string {
  // Try to match against canonical roles first
  for (const [code, label] of Object.entries(ROLE_LABELS)) {
    if (typeOrRoleId?.includes(code) || typeOrRoleId?.toLowerCase().includes(code.toLowerCase())) {
      return label;
    }
  }
  // Return the original type/role if no match
  return typeOrRoleId || "Unknown";
}

export function getCanonicalRoles(): { code: string; label: string }[] {
  return CANONICAL_ROLES.map(code => ({
    code,
    label: ROLE_LABELS[code]
  }));
}

// Fallback data for error states
export const SEED_SHIFTS: Shift[] = [
  {
    id: "1",
    wf_shift_id: "seed_1",
    wf_role_id: "pa_role",
    start_utc: null,
    end_utc: null,
    date_local: "2025-05-20",
    inspector_name: "Mads Madsen",
    department: "Sjælland",
    type: "All",
    status: "Planlagt",
    created_at: new Date().toISOString()
  },
  {
    id: "2", 
    wf_shift_id: "seed_2",
    wf_role_id: "if_role",
    start_utc: "2026-06-20T07:00:00Z",
    end_utc: "2026-06-20T08:00:00Z",
    date_local: "2026-06-20",
    inspector_name: "Albert B",
    department: "Jylland",
    type: "IF,PF",
    status: "Flyttet",
    created_at: new Date().toISOString()
  }
];