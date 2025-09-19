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
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_availability_compat"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
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
          on_date: string
          start_time_local: string
        }
        Insert: {
          end_time_local: string
          id?: number
          inspector_id: number
          on_date: string
          start_time_local: string
        }
        Update: {
          end_time_local?: string
          id?: number
          inspector_id?: number
          on_date?: string
          start_time_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspector_availability_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_availability_compat"
            referencedColumns: ["inspector_id"]
          },
          {
            foreignKeyName: "inspector_availability_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_skills: {
        Row: {
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id: number
        }
        Insert: {
          inspection_type: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id: number
        }
        Update: {
          inspection_type?: Database["public"]["Enums"]["inspection_type_enum"]
          inspector_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspector_skills_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspector_availability_compat"
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
          created_at: string
          email: string | null
          end_address: string | null
          full_name: string
          id: number
          max_work_hours: number
          start_address: string
          timezone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          end_address?: string | null
          full_name: string
          id?: number
          max_work_hours?: number
          start_address: string
          timezone?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          end_address?: string | null
          full_name?: string
          id?: number
          max_work_hours?: number
          start_address?: string
          timezone?: string
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
          key: string
          minutes: number
          updated_at: string
        }
        Insert: {
          key: string
          minutes: number
          updated_at?: string
        }
        Update: {
          key?: string
          minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      supabase_availability: {
        Row: {
          date_local: string
          fetched_at: string | null
          id: string
          inspector_id: string
          inspector_name: string
          is_available: boolean
          raw_payload: Json | null
          source: string | null
        }
        Insert: {
          date_local: string
          fetched_at?: string | null
          id?: string
          inspector_id: string
          inspector_name: string
          is_available?: boolean
          raw_payload?: Json | null
          source?: string | null
        }
        Update: {
          date_local?: string
          fetched_at?: string | null
          id?: string
          inspector_id?: string
          inspector_name?: string
          is_available?: boolean
          raw_payload?: Json | null
          source?: string | null
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
          created_at: string | null
          date_local: string
          department: string
          id: string
          inspection_id: string | null
          inspector_id: string
          inspector_name: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string | null
          date_local: string
          department: string
          id?: string
          inspection_id?: string | null
          inspector_id: string
          inspector_name: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string | null
          date_local?: string
          department?: string
          id?: string
          inspection_id?: string | null
          inspector_id?: string
          inspector_name?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "supabase_shifts_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "supabase_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inspector_availability_compat: {
        Row: {
          availability_str: string | null
          inspector_id: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      sync_workfeed_availability_stub: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
