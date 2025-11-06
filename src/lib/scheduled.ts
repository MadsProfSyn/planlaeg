import { supabase } from "@/integrations/supabase/client";

export interface ProposedAssignment {
  id: string;
  inspection_id: string;
  inspector_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  sequence_in_route: number;
  travel_from_previous_mins: number;
  status: string;
  created_at: string;
  assignment_source?: string;
  manual_override_at?: string;
  manual_override_by?: string;
  // Joined data
  inspector_name?: string;
  inspection_address?: string;
  inspection_type?: string;
  inspection_department?: string;
  manual_override_user_name?: string;
}

export interface ScheduledFilters {
  departments?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  types?: string[];
  globalSearch?: string;
}

export async function getProposedAssignments(
  filters: ScheduledFilters = {}
): Promise<ProposedAssignment[]> {
  let query = supabase
    .from("proposed_assignments")
    .select(
      `
      *,
      inspectors!inner(full_name),
      inspection_queue!inner(address, inspection_type, department),
      profiles!manual_override_by(full_name)
    `
    )
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Apply filters
  if (filters.departments && filters.departments.length > 0) {
    query = query.in("inspection_queue.department", filters.departments);
  }

  if (filters.dateFrom) {
    query = query.gte("scheduled_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("scheduled_date", filters.dateTo);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch proposed assignments: ${error.message}`);
  }

  // Transform the data to flatten the joined fields
  return (
    data?.map((item: any) => ({
      ...item,
      inspector_name: item.inspectors?.full_name,
      inspection_address: item.inspection_queue?.address,
      inspection_type: item.inspection_queue?.inspection_type,
      inspection_department: item.inspection_queue?.department,
      manual_override_user_name: item.profiles?.full_name,
    })) || []
  );
}

export async function reassignInspector(
  assignmentId: string,
  newInspectorId: string
): Promise<any> {
  const { data, error } = await supabase.functions.invoke("reassign-inspector", {
    body: {
      assignment_id: assignmentId,
      new_inspector_id: newInspectorId,
    },
  });

  if (error) {
    throw new Error(`Failed to reassign inspector: ${error.message}`);
  }

  return data;
}

export async function getAvailableInspectors(date: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("inspectors")
    .select(
      `
      *,
      supabase_availability!inner(
        is_available,
        start_time_local,
        end_time_local,
        source,
        availability_time_ranges(start_time, end_time)
      ),
      inspector_skills(inspection_type)
    `
    )
    .eq("is_active", true)
    .eq("supabase_availability.date_local", date)
    .eq("supabase_availability.is_available", true);

  if (error) {
    throw new Error(`Failed to fetch available inspectors: ${error.message}`);
  }

  return data || [];
}
