// VRP (Vehicle Routing Problem) Type Definitions

export interface InspectionForVrp {
  id: string;
  address: string;
  inspection_type: string;
  preferred_date: string;
  rooms: number;
  department: string;
  lat: number | null;
  lng: number | null;
  customer_name?: string;
}

export interface VrpAssignment {
  inspection_id: string;
  inspector_id: string;
  inspector_name: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  sequence_in_route: number;
  travel_from_previous_mins: number;
  inspection_address?: string;
  inspection_type?: string;
}

export interface VrpRouteLeg {
  from_syn_id: string | null;
  to_syn_id: string | null;
  eta_minutes: number;
  distance_km: number;
}

export interface VrpRoutePlan {
  ordered_syn_ids: string[];
  assignments: VrpAssignment[];
  total_distance_km: number;
  total_eta_minutes: number;
  legs: VrpRouteLeg[];
}

export interface VrpComputeRequest {
  inspection_ids: string[];
  target_dates: string[];
}

export interface VrpComputeResponse {
  success: boolean;
  route_plan: VrpRoutePlan | null;
  error?: string;
}

export interface VrpApprovalRequest {
  vrp_run_id: string;
  assignments: VrpAssignment[];
  inspection_ids: string[];
}

export interface VrpApprovalResponse {
  success: boolean;
  vrp_run_id: string;
  approved_count: number;
  error?: string;
}

export interface InspectorRouteSummary {
  inspector_id: string;
  inspector_name: string;
  assignments: VrpAssignment[];
  total_time_mins: number;
  total_distance_km: number;
  total_inspections: number;
  base_address?: string;
  roundtrip_distance_km?: number;
  distance_to_first_km?: number;
  distance_from_last_km?: number;
}

export interface GroupedRoutePlan {
  inspector_routes: InspectorRouteSummary[];
  unassigned_inspections: InspectionForVrp[];
  overall_total_time: number;
  overall_total_distance: number;
}
