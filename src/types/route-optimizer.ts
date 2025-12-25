export interface RouteOptimizerAssignment {
  inspector_id: string;
  inspection_ids: string[];
  existing_ids?: string[]; // IDs of already-scheduled inspections (times are fixed)
}

export interface RouteOptimizerRequest {
  date: string;
  assignments: RouteOptimizerAssignment[];
}

export interface RouteStop {
  sequence: number;
  monday_item_id: number;
  inspection_id?: string;  // Deprecated, use monday_item_id
  address: string;
  start_time: string;
  end_time: string;
  travel_from_previous_mins: number;
}

export interface InspectorRoute {
  inspector_id: string;
  inspector_name: string;
  total_km: number;
  total_travel_minutes: number;
  stops: RouteStop[];
}

export interface RouteOptimizerMetrics {
  total_scheduled: number;
  total_travel_km: number;
  execution_seconds: number;
}

export interface RouteOptimizerResponse {
  status: "success" | "error";
  vrp_run_id?: string;
  routes: InspectorRoute[];
  metrics: RouteOptimizerMetrics;
  error?: string;
}
