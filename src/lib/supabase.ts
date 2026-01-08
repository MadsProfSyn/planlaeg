import { supabase } from "@/integrations/supabase/client";

export interface MondayItem {
  id: number;
  item_id: number | null;
  board_id: number | null;
  name: string | null;
  adresse: string | null;
  synstype: string | null;
  dato_tid: string | null;
  antal_vaerelser: number | null;
  Kunde: string | null;
  lejemalsnr: string | null;
  region: string | null;
  landsdel: string | null;
  inserted_at: string | null;
  raw: any | null;
  // Schedule tracking fields
  schedule_status?: string | null;
  wf_shift_id?: string | null;
  scheduled_inspector_id?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  scheduled_at?: string | null;
  scheduled_by?: string | null;
}

export interface MondayItemFilters {
  regions?: string[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

// Legacy types for backward compatibility
export interface Inspection {
  id: string;
  address: string;
  type: string;
  date_local: string;
  department: string;
  status: string;
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

export async function getMondayItems(
  page: number = 1,
  pageSize: number = 50,
  filters: MondayItemFilters = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<MondayItem>> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("monday_items_selected")
    .select("*", { count: "exact" })
    .abortSignal(signal || new AbortController().signal)
    // Only include items NOT yet sent to WorkFeed
    .is("wf_shift_id", null);

  // Apply filters
  if (filters.regions && filters.regions.length > 0) {
    query = query.in("landsdel", filters.regions);
  }

  if (filters.dateFrom) {
    query = query.gte("dato_tid", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("dato_tid", filters.dateTo);
  }

  // Enhanced search: min 2 characters, searches Kunde, lejemalsnr, and adresse
  if (filters.searchQuery) {
    const q = filters.searchQuery.trim();
    if (q.length >= 2) {
      // Use trigram indexes for fast partial matching
      query = query.or(
        [
          `Kunde.ilike.%${q}%`,
          `lejemalsnr.ilike.%${q}%`,
          `adresse.ilike.%${q}%`,
        ].join(',')
      );
    }
  }

  // Order by dato_tid, then inserted_at for consistent pagination
  query = query
    .order("dato_tid", { ascending: true, nullsFirst: false })
    .order("inserted_at", { ascending: true })
    .range(start, end);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch Monday items: ${error.message}`);
  }

  const totalPages = Math.ceil((count || 0) / pageSize);

  return {
    data: (data || []) as MondayItem[],
    count: count || 0,
    totalPages,
    currentPage: page,
  };
}

export async function createMondayItem(item: Partial<MondayItem>): Promise<MondayItem> {
  const { data, error } = await supabase
    .from("monday_items_selected")
    .insert(item)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create Monday item: ${error.message}`);
  }

  return data as MondayItem;
}

export async function updateMondayItem(id: number, updates: Partial<MondayItem>): Promise<MondayItem> {
  const { data, error } = await supabase
    .from("monday_items_selected")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update Monday item: ${error.message}`);
  }

  return data as MondayItem;
}

export async function deleteMondayItem(id: number): Promise<void> {
  const { error } = await supabase
    .from("monday_items_selected")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete Monday item: ${error.message}`);
  }
}

export async function getRegions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("monday_items_selected")
    .select("landsdel");

  if (error) {
    throw new Error(`Failed to fetch regions: ${error.message}`);
  }

  // Get unique regions
  const regions = Array.from(
    new Set(data?.map((item) => item.landsdel).filter(Boolean) || [])
  ).sort();

  return regions as string[];
}

export async function deleteAllMondayItems(): Promise<number> {
  // Get count first
  const { count } = await supabase
    .from("monday_items_selected")
    .select("*", { count: "exact", head: true });

  // Delete all records
  const { error } = await supabase
    .from("monday_items_selected")
    .delete()
    .neq("id", 0); // Delete all records

  if (error) {
    throw new Error(`Failed to delete all Monday items: ${error.message}`);
  }

  return count || 0;
}