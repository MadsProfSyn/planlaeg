import { supabase } from "@/integrations/supabase/client";

export interface Inspection {
  id: string;
  address: string;
  type: "Proforma" | "Projektsyn" | "Indflytningssyn" | "Fraflytningssyn";
  date_local: string;
  department: string;
  status: "UNSCHEDULED" | "SCHEDULED" | "CANCELLED";
  created_at: string;
  updated_at: string;
}

export interface InspectionFilters {
  departments?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export async function getInspections(
  page: number = 1,
  pageSize: number = 50,
  filters: InspectionFilters = {}
): Promise<PaginatedResponse<Inspection>> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("supabase_inspections")
    .select("*", { count: "exact" })
    .eq("status", "UNSCHEDULED");

  // Apply filters
  if (filters.departments && filters.departments.length > 0) {
    query = query.in("department", filters.departments);
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
    throw new Error(`Failed to fetch inspections: ${error.message}`);
  }

  const totalPages = Math.ceil((count || 0) / pageSize);

  return {
    data: (data || []) as Inspection[],
    count: count || 0,
    totalPages,
    currentPage: page,
  };
}

export async function getDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from("supabase_inspections")
    .select("department")
    .eq("status", "UNSCHEDULED");

  if (error) {
    throw new Error(`Failed to fetch departments: ${error.message}`);
  }

  // Get unique departments
  const departments = Array.from(
    new Set(data?.map((item) => item.department) || [])
  ).sort();

  return departments;
}