export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      afdeling_to_department: {
        Row: {
          afdeling: string
          department: string
        }
        Insert: {
          afdeling: string
          department: string
        }
        Update: {
          afdeling?: string
          department?: string
        }
        Relationships: []
      }
      afdeling_zip: {
        Row: {
          afdeling: string
          zip: number
        }
        Insert: {
          afdeling: string
          zip: number
        }
        Update: {
          afdeling?: string
          zip?: number
        }
        Relationships: [
          {
            foreignKeyName: "afdeling_zip_afdeling_fkey"
            columns: ["afdeling"]
            isOneToOne: false
            referencedRelation: "afdeling_to_department"
            referencedColumns: ["afdeling"]
          },
        ]
      }
      availability_time_ranges: {
        Row: {
          availability_id: string
          created_at: string | null
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          availability_id: string
          created_at?: string | null
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          availability_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_time_ranges_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "supabase_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_route_totals: {
        Row: {
          calculated_at: string | null
          created_at: string | null
          id: string
          includes_return_home: boolean | null
          inspection_count: number
          inspections_km: number | null
          inspector_id: string
          inspector_name: string
          last_stop_address: string | null
          last_stop_lat: number | null
          last_stop_lng: number | null
          return_home_km: number | null
          route_date: string
          total_route_km: number
          total_travel_minutes: number
          updated_at: string | null
        }
        Insert: {
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          includes_return_home?: boolean | null
          inspection_count?: number
          inspections_km?: number | null
          inspector_id: string
          inspector_name: string
          last_stop_address?: string | null
          last_stop_lat?: number | null
          last_stop_lng?: number | null
          return_home_km?: number | null
          route_date: string
          total_route_km?: number
          total_travel_minutes?: number
          updated_at?: string | null
        }
        Update: {
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          includes_return_home?: boolean | null
          inspection_count?: number
          inspections_km?: number | null
          inspector_id?: string
          inspector_name?: string
          last_stop_address?: string | null
          last_stop_lat?: number | null
          last_stop_lng?: number | null
          return_home_km?: number | null
          route_date?: string
          total_route_km?: number
          total_travel_minutes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_route_totals_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "daily_route_totals_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          region: string | null
          updated_at: string | null
          wf_department_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          region?: string | null
          updated_at?: string | null
          wf_department_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          region?: string | null
          updated_at?: string | null
          wf_department_id?: string | null
        }
        Relationships: []
      }
      inspection_duration_modifiers: {
        Row: {
          applies_to: string[]
          minutes: number
          modifier_name: string
        }
        Insert: {
          applies_to?: string[]
          minutes?: number
          modifier_name: string
        }
        Update: {
          applies_to?: string[]
          minutes?: number
          modifier_name?: string
        }
        Relationships: []
      }
      inspection_durations: {
        Row: {
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          minutes: number
          rooms: number
        }
        Insert: {
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          minutes: number
          rooms: number
        }
        Update: {
          inspection_type?: Database["public"]["Enums"]["inspection_type_enum"]
          minutes?: number
          rooms?: number
        }
        Relationships: []
      }
      inspection_queue: {
        Row: {
          address: string
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          department: string
          geocode_status: string | null
          id: string
          inspection_type: string
          lat: number | null
          lease_number: string | null
          lng: number | null
          monday_item_id: number | null
          notes: string | null
          obs: string | null
          planned_at: string | null
          planned_by: string | null
          preferred_date: string
          rooms: number
          status: string | null
          tenant_name: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          department: string
          geocode_status?: string | null
          id?: string
          inspection_type: string
          lat?: number | null
          lease_number?: string | null
          lng?: number | null
          monday_item_id?: number | null
          notes?: string | null
          obs?: string | null
          planned_at?: string | null
          planned_by?: string | null
          preferred_date: string
          rooms: number
          status?: string | null
          tenant_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          department?: string
          geocode_status?: string | null
          id?: string
          inspection_type?: string
          lat?: number | null
          lease_number?: string | null
          lng?: number | null
          monday_item_id?: number | null
          notes?: string | null
          obs?: string | null
          planned_at?: string | null
          planned_by?: string | null
          preferred_date?: string
          rooms?: number
          status?: string | null
          tenant_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inspection_type_mappings: {
        Row: {
          abbreviation: string
          full_name: string
        }
        Insert: {
          abbreviation: string
          full_name: string
        }
        Update: {
          abbreviation?: string
          full_name?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          address: string
          created_at: string
          end_time: string | null
          id: number
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id: number | null
          on_date: string
          rooms: number
          start_time: string | null
          status: Database["public"]["Enums"]["inspection_status_enum"]
          travel_time_min: number | null
        }
        Insert: {
          address: string
          created_at?: string
          end_time?: string | null
          id?: number
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id?: number | null
          on_date: string
          rooms: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["inspection_status_enum"]
          travel_time_min?: number | null
        }
        Update: {
          address?: string
          created_at?: string
          end_time?: string | null
          id?: number
          inspection_type?: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id?: number | null
          on_date?: string
          rooms?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["inspection_status_enum"]
          travel_time_min?: number | null
        }
        Relationships: []
      }
      inspections_vrp: {
        Row: {
          created_at: string | null
          id: string
          inspection_id: string | null
          inspector_id: string
          inspector_name: string
          run_id: string
          score: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          inspector_id: string
          inspector_name: string
          run_id: string
          score?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          inspector_id?: string
          inspector_name?: string
          run_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_vrp_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "supabase_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_availability: {
        Row: {
          end_time_local: string
          id: number
          inspector_id: number
          inspector_uuid: string
          on_date: string
          start_time_local: string
        }
        Insert: {
          end_time_local: string
          id?: number
          inspector_id: number
          inspector_uuid: string
          on_date: string
          start_time_local: string
        }
        Update: {
          end_time_local?: string
          id?: number
          inspector_id?: number
          inspector_uuid?: string
          on_date?: string
          start_time_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspector_availability_inspector_fk"
            columns: ["inspector_uuid"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "inspector_availability_inspector_fk"
            columns: ["inspector_uuid"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_skills: {
        Row: {
          certified_date: string | null
          created_at: string | null
          expires_date: string | null
          id: string
          inspection_type: string
          inspector_id: string
          is_active: boolean | null
        }
        Insert: {
          certified_date?: string | null
          created_at?: string | null
          expires_date?: string | null
          id?: string
          inspection_type: string
          inspector_id: string
          is_active?: boolean | null
        }
        Update: {
          certified_date?: string | null
          created_at?: string | null
          expires_date?: string | null
          id?: string
          inspection_type?: string
          inspector_id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inspector_skills_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "inspector_skills_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors: {
        Row: {
          address: string | null
          created_at: string | null
          department_id: string | null
          email: string
          first_name: string | null
          full_name: string
          geocode_error: string | null
          geocode_status: string | null
          id: string
          ignore_wf_warning: boolean
          is_active: boolean | null
          lat: number | null
          lng: number | null
          notes: string | null
          phone: string | null
          updated_at: string | null
          wf_checked_at: string | null
          wf_employee_id: string | null
          wf_status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          department_id?: string | null
          email: string
          first_name?: string | null
          full_name: string
          geocode_error?: string | null
          geocode_status?: string | null
          id?: string
          ignore_wf_warning?: boolean
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          wf_checked_at?: string | null
          wf_employee_id?: string | null
          wf_status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string
          first_name?: string | null
          full_name?: string
          geocode_error?: string | null
          geocode_status?: string | null
          id?: string
          ignore_wf_warning?: boolean
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          wf_checked_at?: string | null
          wf_employee_id?: string | null
          wf_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors_dublicate: {
        Row: {
          address: string | null
          created_at: string | null
          department_id: string | null
          email: string
          full_name: string
          geocode_error: string | null
          geocode_status: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          notes: string | null
          phone: string | null
          role_ids: string | null
          role_ids_array: string[] | null
          updated_at: string | null
          wf_department_id: string | null
          wf_employee_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          department_id?: string | null
          email: string
          full_name: string
          geocode_error?: string | null
          geocode_status?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          role_ids?: string | null
          role_ids_array?: string[] | null
          updated_at?: string | null
          wf_department_id?: string | null
          wf_employee_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          geocode_error?: string | null
          geocode_status?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          role_ids?: string | null
          role_ids_array?: string[] | null
          updated_at?: string | null
          wf_department_id?: string | null
          wf_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_dublicate_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors_import_staging: {
        Row: {
          address: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          types_csv: string | null
          wf_department_id_by_name: string | null
          wf_department_ids: string[] | null
          wf_employee_id: string | null
          wf_primary_department_id: string | null
        }
        Insert: {
          address?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          types_csv?: string | null
          wf_department_id_by_name?: string | null
          wf_department_ids?: string[] | null
          wf_employee_id?: string | null
          wf_primary_department_id?: string | null
        }
        Update: {
          address?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          types_csv?: string | null
          wf_department_id_by_name?: string | null
          wf_department_ids?: string[] | null
          wf_employee_id?: string | null
          wf_primary_department_id?: string | null
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          action: string
          created_at: string
          id: number
          item_id: number | null
          message: string | null
          ok: boolean
          source: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          item_id?: number | null
          message?: string | null
          ok?: boolean
          source: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          item_id?: number | null
          message?: string | null
          ok?: boolean
          source?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          job_type: string
          params: Json | null
          result: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_type: string
          params?: Json | null
          result?: Json | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_type?: string
          params?: Json | null
          result?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      mapbox_coords_cache: {
        Row: {
          lat: number
          lon: number
          normalized_address: string
          updated_at: string
        }
        Insert: {
          lat: number
          lon: number
          normalized_address: string
          updated_at?: string
        }
        Update: {
          lat?: number
          lon?: number
          normalized_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      mapbox_travel_cache: {
        Row: {
          distance_km: number | null
          key: string
          minutes: number
          updated_at: string
        }
        Insert: {
          distance_km?: number | null
          key: string
          minutes: number
          updated_at?: string
        }
        Update: {
          distance_km?: number | null
          key?: string
          minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      monday_items_selected: {
        Row: {
          adresse: string | null
          antal_vaerelser: number | null
          board_id: number | null
          dato_tid: string | null
          duration_minutes: number | null
          geocode_status: string | null
          has_cylinderskift: boolean | null
          has_dymo: boolean | null
          id: number
          inserted_at: string | null
          item_id: number | null
          Kunde: string | null
          landsdel: string | null
          lat: number | null
          lejemalsnr: string | null
          lng: number | null
          name: string | null
          note: string | null
          raw: Json | null
          region: string | null
          route_km: number | null
          route_sequence: number | null
          route_travel_minutes: number | null
          schedule_status: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_date: string | null
          scheduled_end_time: string | null
          scheduled_inspector_id: string | null
          scheduled_inspector_name: string | null
          scheduled_start_time: string | null
          synstype: string | null
          wf_shift_id: string | null
        }
        Insert: {
          adresse?: string | null
          antal_vaerelser?: number | null
          board_id?: number | null
          dato_tid?: string | null
          duration_minutes?: number | null
          geocode_status?: string | null
          has_cylinderskift?: boolean | null
          has_dymo?: boolean | null
          id?: number
          inserted_at?: string | null
          item_id?: number | null
          Kunde?: string | null
          landsdel?: string | null
          lat?: number | null
          lejemalsnr?: string | null
          lng?: number | null
          name?: string | null
          note?: string | null
          raw?: Json | null
          region?: string | null
          route_km?: number | null
          route_sequence?: number | null
          route_travel_minutes?: number | null
          schedule_status?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_inspector_id?: string | null
          scheduled_inspector_name?: string | null
          scheduled_start_time?: string | null
          synstype?: string | null
          wf_shift_id?: string | null
        }
        Update: {
          adresse?: string | null
          antal_vaerelser?: number | null
          board_id?: number | null
          dato_tid?: string | null
          duration_minutes?: number | null
          geocode_status?: string | null
          has_cylinderskift?: boolean | null
          has_dymo?: boolean | null
          id?: number
          inserted_at?: string | null
          item_id?: number | null
          Kunde?: string | null
          landsdel?: string | null
          lat?: number | null
          lejemalsnr?: string | null
          lng?: number | null
          name?: string | null
          note?: string | null
          raw?: Json | null
          region?: string | null
          route_km?: number | null
          route_sequence?: number | null
          route_travel_minutes?: number | null
          schedule_status?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_inspector_id?: string | null
          scheduled_inspector_name?: string | null
          scheduled_start_time?: string | null
          synstype?: string | null
          wf_shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monday_items_selected_scheduled_inspector_id_fkey"
            columns: ["scheduled_inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "monday_items_selected_scheduled_inspector_id_fkey"
            columns: ["scheduled_inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      proposed_assignments: {
        Row: {
          assignment_source: string | null
          created_at: string | null
          end_time: string
          id: string
          inspection_id: string
          inspector_id: string
          inspector_route_km: number | null
          inspector_total_route_km: number | null
          manual_override_at: string | null
          manual_override_by: string | null
          scheduled_date: string
          sequence_in_route: number | null
          start_time: string
          status: string | null
          travel_from_previous_mins: number | null
          vrp_run_id: string
        }
        Insert: {
          assignment_source?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          inspection_id: string
          inspector_id: string
          inspector_route_km?: number | null
          inspector_total_route_km?: number | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          scheduled_date: string
          sequence_in_route?: number | null
          start_time: string
          status?: string | null
          travel_from_previous_mins?: number | null
          vrp_run_id: string
        }
        Update: {
          assignment_source?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          inspection_id?: string
          inspector_id?: string
          inspector_route_km?: number | null
          inspector_total_route_km?: number | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          scheduled_date?: string
          sequence_in_route?: number | null
          start_time?: string
          status?: string | null
          travel_from_previous_mins?: number | null
          vrp_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_assignments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_assignments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections_with_planner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_assignments_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "proposed_assignments_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_assignments_manual_override_by_fkey"
            columns: ["manual_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_assignments_vrp_run_id_fkey"
            columns: ["vrp_run_id"]
            isOneToOne: false
            referencedRelation: "vrp_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rapport_errors: {
        Row: {
          address: string | null
          created_at: string | null
          email_sent: boolean | null
          errors: string[] | null
          id: string
          report_type: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          errors?: string[] | null
          id?: string
          report_type?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          errors?: string[] | null
          id?: string
          report_type?: string | null
        }
        Relationships: []
      }
      role_mappings: {
        Row: {
          role_id: string | null
          wf_role_id: string
          wf_role_name: string
        }
        Insert: {
          role_id?: string | null
          wf_role_id: string
          wf_role_name: string
        }
        Update: {
          role_id?: string | null
          wf_role_id?: string
          wf_role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_mappings_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          id: string
          label: string
        }
        Insert: {
          code: string
          id?: string
          label: string
        }
        Update: {
          code?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string | null
          ends_at: string
          external_id: string
          id: string
          inspector_id: string
          source: string
          starts_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          external_id: string
          id?: string
          inspector_id: string
          source: string
          starts_at: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          external_id?: string
          id?: string
          inspector_id?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "shifts_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_reminder_logs: {
        Row: {
          batch_id: string
          created_at: string | null
          failure_reason: string | null
          id: string
          inspector_id: string
          inspector_name: string
          message_preview: string | null
          phone: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          target_date: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          inspector_id: string
          inspector_name: string
          message_preview?: string | null
          phone?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status: string
          target_date: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          inspector_id?: string
          inspector_name?: string
          message_preview?: string | null
          phone?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          target_date?: string
        }
        Relationships: []
      }
      supabase_availability: {
        Row: {
          availability_status: string | null
          created_at_source: string | null
          date_local: string
          department: string | null
          end_time_local: string | null
          fetched_at: string | null
          id: string
          inspector_id: string
          inspector_name: string
          is_available: boolean
          raw_payload: Json | null
          source: string | null
          start_time_local: string | null
          updated_at_source: string | null
          wf_availability_id: string | null
          wf_type: string | null
        }
        Insert: {
          availability_status?: string | null
          created_at_source?: string | null
          date_local: string
          department?: string | null
          end_time_local?: string | null
          fetched_at?: string | null
          id?: string
          inspector_id: string
          inspector_name: string
          is_available?: boolean
          raw_payload?: Json | null
          source?: string | null
          start_time_local?: string | null
          updated_at_source?: string | null
          wf_availability_id?: string | null
          wf_type?: string | null
        }
        Update: {
          availability_status?: string | null
          created_at_source?: string | null
          date_local?: string
          department?: string | null
          end_time_local?: string | null
          fetched_at?: string | null
          id?: string
          inspector_id?: string
          inspector_name?: string
          is_available?: boolean
          raw_payload?: Json | null
          source?: string | null
          start_time_local?: string | null
          updated_at_source?: string | null
          wf_availability_id?: string | null
          wf_type?: string | null
        }
        Relationships: []
      }
      supabase_inspections: {
        Row: {
          address: string
          created_at: string | null
          date_local: string
          department: string
          id: string
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          date_local: string
          department: string
          id?: string
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          date_local?: string
          department?: string
          id?: string
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supabase_shifts: {
        Row: {
          address: string | null
          created_at: string | null
          date_local: string
          department: string
          duration_minutes: number | null
          end_time_local: string | null
          end_utc: string | null
          geocode_status: string
          id: string
          inspection_id: string | null
          inspection_queue_id: string | null
          inspector_id: string
          inspector_name: string
          last_sync_attempt: string | null
          lat: number | null
          lng: number | null
          route_km: number | null
          route_sequence: number | null
          route_travel_minutes: number | null
          start_time_local: string | null
          start_utc: string | null
          status: string
          sync_attempts: number | null
          sync_error: string | null
          sync_status: string | null
          type: string
          wf_employee_id: string
          wf_role_id: string | null
          wf_shift_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date_local: string
          department: string
          duration_minutes?: number | null
          end_time_local?: string | null
          end_utc?: string | null
          geocode_status?: string
          id?: string
          inspection_id?: string | null
          inspection_queue_id?: string | null
          inspector_id: string
          inspector_name: string
          last_sync_attempt?: string | null
          lat?: number | null
          lng?: number | null
          route_km?: number | null
          route_sequence?: number | null
          route_travel_minutes?: number | null
          start_time_local?: string | null
          start_utc?: string | null
          status?: string
          sync_attempts?: number | null
          sync_error?: string | null
          sync_status?: string | null
          type: string
          wf_employee_id: string
          wf_role_id?: string | null
          wf_shift_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date_local?: string
          department?: string
          duration_minutes?: number | null
          end_time_local?: string | null
          end_utc?: string | null
          geocode_status?: string
          id?: string
          inspection_id?: string | null
          inspection_queue_id?: string | null
          inspector_id?: string
          inspector_name?: string
          last_sync_attempt?: string | null
          lat?: number | null
          lng?: number | null
          route_km?: number | null
          route_sequence?: number | null
          route_travel_minutes?: number | null
          start_time_local?: string | null
          start_utc?: string | null
          status?: string
          sync_attempts?: number | null
          sync_error?: string | null
          sync_status?: string | null
          type?: string
          wf_employee_id?: string
          wf_role_id?: string | null
          wf_shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supabase_shifts_inspector"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_warnings"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "fk_supabase_shifts_inspector"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supabase_shifts_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "supabase_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supabase_shifts_inspection_queue_id_fkey"
            columns: ["inspection_queue_id"]
            isOneToOne: false
            referencedRelation: "inspection_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supabase_shifts_inspection_queue_id_fkey"
            columns: ["inspection_queue_id"]
            isOneToOne: false
            referencedRelation: "inspections_with_planner"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vrp_runs: {
        Row: {
          ai_explanation: string | null
          approved_at: string | null
          created_at: string | null
          execution_seconds: number | null
          id: string
          inspection_ids: string[]
          num_inspections_scheduled: number | null
          requested_by: string
          reviewed_by: string | null
          solution_json: Json | null
          status: string | null
          target_dates: string[]
          total_travel_km: number | null
          total_travel_minutes: number | null
          triggered_by: string | null
        }
        Insert: {
          ai_explanation?: string | null
          approved_at?: string | null
          created_at?: string | null
          execution_seconds?: number | null
          id?: string
          inspection_ids: string[]
          num_inspections_scheduled?: number | null
          requested_by: string
          reviewed_by?: string | null
          solution_json?: Json | null
          status?: string | null
          target_dates: string[]
          total_travel_km?: number | null
          total_travel_minutes?: number | null
          triggered_by?: string | null
        }
        Update: {
          ai_explanation?: string | null
          approved_at?: string | null
          created_at?: string | null
          execution_seconds?: number | null
          id?: string
          inspection_ids?: string[]
          num_inspections_scheduled?: number | null
          requested_by?: string
          reviewed_by?: string | null
          solution_json?: Json | null
          status?: string | null
          target_dates?: string[]
          total_travel_km?: number | null
          total_travel_minutes?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      worker_keepalive_log: {
        Row: {
          id: number
          pinged_at: string | null
          response_body: string | null
          response_status: number | null
        }
        Insert: {
          id?: number
          pinged_at?: string | null
          response_body?: string | null
          response_status?: number | null
        }
        Update: {
          id?: number
          pinged_at?: string | null
          response_body?: string | null
          response_status?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      inspections_with_planner: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          department: string | null
          geocode_status: string | null
          id: string | null
          inspection_type: string | null
          lat: number | null
          lease_number: string | null
          lng: number | null
          monday_item_id: number | null
          planned_at: string | null
          planned_at_resolved: string | null
          planned_by: string | null
          planner_email: string | null
          planner_name: string | null
          preferred_date: string | null
          rooms: number | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      inspector_capacity_view: {
        Row: {
          booked_minutes: number | null
          capacity_status: string | null
          date_local: string | null
          department: string | null
          end_time_local: string | null
          inspector_id: string | null
          inspector_name: string | null
          is_available: boolean | null
          percent_booked: number | null
          remaining_minutes: number | null
          scheduled_shifts: number | null
          shift_details: Json | null
          shift_types: string[] | null
          start_time_local: string | null
          total_minutes: number | null
        }
        Relationships: []
      }
      inspector_warnings: {
        Row: {
          available_days_ahead: number | null
          department: string | null
          full_name: string | null
          inspector_id: string | null
          label: string | null
          priority: number | null
          warning: string | null
        }
        Relationships: []
      }
      system_status: {
        Row: {
          detail: string | null
          key: string | null
          label: string | null
          last_at: string | null
          sort_order: number | null
          status: string | null
        }
        Relationships: []
      }
      vw_postcode_to_department: {
        Row: {
          afdeling: string | null
          department: string | null
          zip: number | null
        }
        Relationships: [
          {
            foreignKeyName: "afdeling_zip_afdeling_fkey"
            columns: ["afdeling"]
            isOneToOne: false
            referencedRelation: "afdeling_to_department"
            referencedColumns: ["afdeling"]
          },
        ]
      }
      vw_shifts_ui: {
        Row: {
          canonical_code: string | null
          canonical_label: string | null
          canonical_type: string | null
          date_local: string | null
          department: string | null
          id: string | null
          inspector_name: string | null
          wf_role_id: string | null
          wf_role_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_jobs: { Args: { hours_old?: number }; Returns: number }
      demote_admin: { Args: { target_email: string }; Returns: undefined }
      get_availability_overview: {
        Args: { p_target_dates: string[] }
        Returns: {
          availability_status: string
          date_local: string
          department: string
          email: string
          end_time_local: string
          inspector_id: string
          inspector_name: string
          last_updated: string
          phone: string
          start_time_local: string
          wf_employee_id: string
        }[]
      }
      get_availability_summary: {
        Args: { p_target_dates: string[] }
        Returns: {
          available_count: number
          date_local: string
          no_response_count: number
          not_available_count: number
          response_rate: number
          total_inspectors: number
        }[]
      }
      get_or_create_inspector_uuid: {
        Args: { emp_name: string; wf_emp_id: string }
        Returns: string
      }
      get_vrp_input: {
        Args: { p_inspection_ids: string[]; p_target_dates: string[] }
        Returns: Json
      }
      get_wf_role_id_for_inspection: {
        Args: { p_inspection_type: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_dk_address: { Args: { addr: string }; Returns: string }
      ping_vrp_worker: { Args: never; Returns: undefined }
      promote_user: { Args: { target_email: string }; Returns: undefined }
      reassign_inspector_manual: {
        Args: {
          p_assignment_id: string
          p_new_inspector_id: string
          p_user_id: string
        }
        Returns: Json
      }
      replace_shifts_window: {
        Args: { p_from: string; p_rows: Json; p_to: string }
        Returns: number
      }
      save_vrp_solution: {
        Args: {
          p_assignments: Json
          p_inspection_ids: string[]
          p_metrics: Json
          p_run_id: string
          p_target_dates: string[]
        }
        Returns: string
      }
      set_consultant_availability: {
        Args: {
          p_date: string
          p_end_time?: string
          p_inspector_id: string
          p_is_available: boolean
          p_source?: string
          p_start_time?: string
        }
        Returns: Json
      }
      set_consultant_availability_with_ranges: {
        Args: {
          p_date: string
          p_inspector_id: string
          p_is_available: boolean
          p_source?: string
          p_time_ranges?: Json
        }
        Returns: Json
      }
      set_inspector_wf_status: {
        Args: { p_active: string[]; p_office: string[] }
        Returns: number
      }
      sync_workfeed_availability_stub: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "user" | "admin"
      inspection_status_enum:
        | "unscheduled"
        | "scheduled"
        | "completed"
        | "canceled"
      inspection_type_enum: "FF" | "IF" | "PS" | "PA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin"],
      inspection_status_enum: [
        "unscheduled",
        "scheduled",
        "completed",
        "canceled",
      ],
      inspection_type_enum: ["FF", "IF", "PS", "PA"],
    },
  },
} as const
