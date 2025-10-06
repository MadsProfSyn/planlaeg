import { supabase } from "@/integrations/supabase/client";
import type {
  VrpComputeRequest,
  VrpComputeResponse,
  VrpApprovalRequest,
  VrpApprovalResponse,
  VrpRoutePlan,
} from "@/types/vrp";

/**
 * Call the VRP edge function to compute optimal routes for selected inspections
 */
export async function computeVrpRoutes(
  inspectionIds: string[],
  targetDates: string[]
): Promise<VrpRoutePlan> {
  const { data, error } = await supabase.functions.invoke<VrpComputeResponse>(
    "compute-vrp-routes",
    {
      body: {
        inspection_ids: inspectionIds,
        target_dates: targetDates,
      } as VrpComputeRequest,
    }
  );

  if (error) {
    throw new Error(`VRP computation failed: ${error.message}`);
  }

  if (!data?.success || !data.route_plan) {
    throw new Error(data?.error || "Failed to compute routes");
  }

  return data.route_plan;
}

/**
 * Approve VRP assignments and persist to database
 */
export async function approveVrpAssignments(
  request: VrpApprovalRequest
): Promise<VrpApprovalResponse> {
  const { data, error } = await supabase.functions.invoke<VrpApprovalResponse>(
    "approve-vrp-assignments",
    {
      body: request,
    }
  );

  if (error) {
    throw new Error(`VRP approval failed: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to approve assignments");
  }

  return data;
}

/**
 * Fetch inspections by IDs for VRP modal display
 */
export async function getInspectionsByIds(inspectionIds: string[]) {
  const { data, error } = await supabase
    .from("inspection_queue")
    .select("*")
    .in("id", inspectionIds);

  if (error) {
    throw new Error(`Failed to fetch inspections: ${error.message}`);
  }

  return data || [];
}
