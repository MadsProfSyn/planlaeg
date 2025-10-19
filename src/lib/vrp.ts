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
 * Transform Monday items to inspection queue records for VRP processing
 */
export async function transformMondayItemsToInspections(
  mondayItemIds: number[]
): Promise<string[]> {
  // Fetch Monday items by IDs
  const { data: mondayItems, error: fetchError } = await supabase
    .from("monday_items_selected")
    .select("*")
    .in("id", mondayItemIds);

  if (fetchError) {
    throw new Error(`Failed to fetch Monday items: ${fetchError.message}`);
  }

  if (!mondayItems || mondayItems.length === 0) {
    throw new Error("No Monday items found");
  }

  // Transform and insert into inspection_queue
  const inspectionRecords = mondayItems.map((item) => ({
    monday_item_id: item.id,
    address: item.adresse || "",
    inspection_type: item.synstype || "Ukendt",
    rooms: item.antal_vaerelser || 0,
    preferred_date: item.dato_tid
      ? new Date(item.dato_tid).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    customer_name: item.Kunde || "",
    lease_number: item.lejemalsnr || "",
    department: item.landsdel || "Ukendt",
    status: "PENDING",
    geocode_status: "pending",
  }));

  const { data: created, error: insertError } = await supabase
    .from("inspection_queue")
    .insert(inspectionRecords)
    .select("id");

  if (insertError) {
    throw new Error(`Failed to create inspections: ${insertError.message}`);
  }

  const inspectionIds = created.map((record) => record.id);

  // Trigger geocoding for the new inspections
  const { error: geocodeError } = await supabase.functions.invoke(
    "geocode-addresses",
    {
      body: { inspection_ids: inspectionIds },
    }
  );

  if (geocodeError) {
    console.warn("Geocoding failed:", geocodeError);
    // Don't throw - allow process to continue with partial data
  }

  return inspectionIds;
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
