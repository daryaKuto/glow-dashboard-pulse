export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          first_name: string | null
          last_name: string | null
          display_name: string | null
          avatar_url: string | null
          phone: string | null
          timezone: string
          language: string
          units: string
          is_active: boolean
          last_login_at: string | null
          profile_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          language?: string
          units?: string
          is_active?: boolean
          last_login_at?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          language?: string
          units?: string
          is_active?: boolean
          last_login_at?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          target_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          target_preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      user_rooms: {
        Row: {
          id: string
          user_id: string
          name: string
          room_type: string
          icon: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          room_type?: string
          icon?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          room_type?: string
          icon?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_room_targets: {
        Row: {
          id: string
          user_id: string
          room_id: string
          target_id: string
          target_name: string
          assigned_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room_id: string
          target_id: string
          target_name: string
          assigned_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string
          target_id?: string
          target_name?: string
          assigned_at?: string
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          room_id: string | null
          room_name: string | null
          scenario_name: string | null
          scenario_type: string | null
          score: number
          duration_ms: number
          hit_count: number
          miss_count: number
          total_shots: number
          accuracy_percentage: number
          avg_reaction_time_ms: number | null
          best_reaction_time_ms: number | null
          worst_reaction_time_ms: number | null
          started_at: string
          ended_at: string | null
          created_at: string
          thingsboard_data: Json
          raw_sensor_data: Json
        }
        Insert: {
          id?: string
          user_id: string
          room_id?: string | null
          room_name?: string | null
          scenario_name?: string | null
          scenario_type?: string | null
          score?: number
          duration_ms?: number
          hit_count?: number
          miss_count?: number
          total_shots?: number
          accuracy_percentage?: number
          avg_reaction_time_ms?: number | null
          best_reaction_time_ms?: number | null
          worst_reaction_time_ms?: number | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
          thingsboard_data?: Json
          raw_sensor_data?: Json
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string | null
          room_name?: string | null
          scenario_name?: string | null
          scenario_type?: string | null
          score?: number
          duration_ms?: number
          hit_count?: number
          miss_count?: number
          total_shots?: number
          accuracy_percentage?: number
          avg_reaction_time_ms?: number | null
          best_reaction_time_ms?: number | null
          worst_reaction_time_ms?: number | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
          thingsboard_data?: Json
          raw_sensor_data?: Json
        }
      }
      session_hits: {
        Row: {
          id: string
          session_id: string
          user_id: string
          target_id: string | null
          target_name: string | null
          room_name: string | null
          hit_type: string
          reaction_time_ms: number | null
          score: number
          hit_timestamp: string
          hit_position: Json
          sensor_data: Json
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          target_id?: string | null
          target_name?: string | null
          room_name?: string | null
          hit_type?: string
          reaction_time_ms?: number | null
          score?: number
          hit_timestamp?: string
          hit_position?: Json
          sensor_data?: Json
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          target_id?: string | null
          target_name?: string | null
          room_name?: string | null
          hit_type?: string
          reaction_time_ms?: number | null
          score?: number
          hit_timestamp?: string
          hit_position?: Json
          sensor_data?: Json
        }
      }
      user_analytics: {
        Row: {
          id: string
          user_id: string
          date: string
          period_type: string
          total_sessions: number
          total_duration_ms: number
          avg_session_duration_ms: number
          total_score: number
          avg_score: number
          best_score: number
          total_shots: number
          total_hits: number
          total_misses: number
          accuracy_percentage: number
          avg_reaction_time_ms: number | null
          best_reaction_time_ms: number | null
          worst_reaction_time_ms: number | null
          score_improvement: number
          accuracy_improvement: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          period_type?: string
          total_sessions?: number
          total_duration_ms?: number
          avg_session_duration_ms?: number
          total_score?: number
          avg_score?: number
          best_score?: number
          total_shots?: number
          total_hits?: number
          total_misses?: number
          accuracy_percentage?: number
          avg_reaction_time_ms?: number | null
          best_reaction_time_ms?: number | null
          worst_reaction_time_ms?: number | null
          score_improvement?: number
          accuracy_improvement?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          period_type?: string
          total_sessions?: number
          total_duration_ms?: number
          avg_session_duration_ms?: number
          total_score?: number
          avg_score?: number
          best_score?: number
          total_shots?: number
          total_hits?: number
          total_misses?: number
          accuracy_percentage?: number
          avg_reaction_time_ms?: number | null
          best_reaction_time_ms?: number | null
          worst_reaction_time_ms?: number | null
          score_improvement?: number
          accuracy_improvement?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
