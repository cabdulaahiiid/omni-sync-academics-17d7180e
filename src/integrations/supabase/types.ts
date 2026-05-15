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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approval_queue: {
        Row: {
          conflict_trainer: boolean
          conflict_venue: boolean
          created_at: string
          excessive_load: boolean
          id: string
          invalid_qualification: boolean
          schedule_id: string
        }
        Insert: {
          conflict_trainer?: boolean
          conflict_venue?: boolean
          created_at?: string
          excessive_load?: boolean
          id?: string
          invalid_qualification?: boolean
          schedule_id: string
        }
        Update: {
          conflict_trainer?: boolean
          conflict_venue?: boolean
          created_at?: string
          excessive_load?: boolean
          id?: string
          invalid_qualification?: boolean
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_queue_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          attendance_timestamp: string
          id: string
          present: boolean
          schedule_id: string
          student_id: string
          submitted_by: string | null
        }
        Insert: {
          attendance_timestamp?: string
          id?: string
          present?: boolean
          schedule_id: string
          student_id: string
          submitted_by?: string | null
        }
        Update: {
          attendance_timestamp?: string
          id?: string
          present?: boolean
          schedule_id?: string
          student_id?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_overrides: {
        Row: {
          attendance_log_id: string
          audit_comment: string
          expires_at: string
          id: string
          new_value: boolean
          old_value: boolean
          overridden_by: string | null
          override_timestamp: string
        }
        Insert: {
          attendance_log_id: string
          audit_comment: string
          expires_at?: string
          id?: string
          new_value: boolean
          old_value: boolean
          overridden_by?: string | null
          override_timestamp?: string
        }
        Update: {
          attendance_log_id?: string
          audit_comment?: string
          expires_at?: string
          id?: string
          new_value?: boolean
          old_value?: boolean
          overridden_by?: string | null
          override_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_overrides_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          device_info: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          timestamp: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          device_info?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          timestamp?: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          device_info?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      department_heads: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_heads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: []
      }
      global_config: {
        Row: {
          allow_offline_sync: boolean
          attendance_window_minutes: number
          geo_fence_radius: number
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_offline_sync?: boolean
          attendance_window_minutes?: number
          geo_fence_radius?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_offline_sync?: boolean
          attendance_window_minutes?: number
          geo_fence_radius?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          trainer_registry_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason: string
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          trainer_registry_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          trainer_registry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_trainer_registry_id_fkey"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: Database["public"]["Enums"]["level_name"]
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: Database["public"]["Enums"]["level_name"]
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: Database["public"]["Enums"]["level_name"]
        }
        Relationships: [
          {
            foreignKeyName: "levels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: string
          created_at: string
          department_id: string
          id: string
          level_id: string
          name: string
          qualifications: string[]
          status: Database["public"]["Enums"]["entity_active"]
          total_hours: number
          total_sessions: number
          type: Database["public"]["Enums"]["module_type"]
        }
        Insert: {
          code: string
          created_at?: string
          department_id: string
          id?: string
          level_id: string
          name: string
          qualifications?: string[]
          status?: Database["public"]["Enums"]["entity_active"]
          total_hours?: number
          total_sessions?: number
          type?: Database["public"]["Enums"]["module_type"]
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string
          id?: string
          level_id?: string
          name?: string
          qualifications?: string[]
          status?: Database["public"]["Enums"]["entity_active"]
          total_hours?: number
          total_sessions?: number
          type?: Database["public"]["Enums"]["module_type"]
        }
        Relationships: [
          {
            foreignKeyName: "modules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: []
      }
      pending_sync: {
        Row: {
          client_timestamp: string
          client_uuid: string
          conflict_reason: string | null
          id: string
          kind: string
          payload: Json
          result: Json | null
          schedule_id: string
          server_received_at: string
          status: string
          trainer_registry_id: string
        }
        Insert: {
          client_timestamp: string
          client_uuid: string
          conflict_reason?: string | null
          id?: string
          kind: string
          payload: Json
          result?: Json | null
          schedule_id: string
          server_received_at?: string
          status?: string
          trainer_registry_id: string
        }
        Update: {
          client_timestamp?: string
          client_uuid?: string
          conflict_reason?: string | null
          id?: string
          kind?: string
          payload?: Json
          result?: Json | null
          schedule_id?: string
          server_received_at?: string
          status?: string
          trainer_registry_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          trainer_registry_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string
          id: string
          trainer_registry_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          trainer_registry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_trainer_registry_fk"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          admin_feedback: string | null
          created_at: string
          created_by: string | null
          date: string
          day: string
          department_id: string
          end_time: string
          hidden_staff_id: string
          id: string
          level_id: string
          module_code: string
          module_name: string
          section_id: string
          semester_id: string
          start_time: string
          status: Database["public"]["Enums"]["schedule_status"]
          trainer_name: string
          trainer_registry_id: string
          venue_id: string
          week_num: number
        }
        Insert: {
          admin_feedback?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          day: string
          department_id: string
          end_time: string
          hidden_staff_id: string
          id?: string
          level_id: string
          module_code: string
          module_name: string
          section_id: string
          semester_id: string
          start_time: string
          status?: Database["public"]["Enums"]["schedule_status"]
          trainer_name: string
          trainer_registry_id: string
          venue_id: string
          week_num: number
        }
        Update: {
          admin_feedback?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          day?: string
          department_id?: string
          end_time?: string
          hidden_staff_id?: string
          id?: string
          level_id?: string
          module_code?: string
          module_name?: string
          section_id?: string
          semester_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          trainer_name?: string
          trainer_registry_id?: string
          venue_id?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semester_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_trainer_registry_id_fkey"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          department_id: string
          id: string
          level_id: string
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          level_id: string
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          level_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_registry: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["semester_status"]
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["semester_status"]
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["semester_status"]
        }
        Relationships: []
      }
      session_logs: {
        Row: {
          checkin_latitude: number | null
          checkin_longitude: number | null
          geo_verified: boolean
          id: string
          learning_outcome: string | null
          lesson_plan: string | null
          schedule_id: string
          session_status: Database["public"]["Enums"]["session_status"]
          submitted_at: string
        }
        Insert: {
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          geo_verified?: boolean
          id?: string
          learning_outcome?: string | null
          lesson_plan?: string | null
          schedule_id: string
          session_status?: Database["public"]["Enums"]["session_status"]
          submitted_at?: string
        }
        Update: {
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          geo_verified?: boolean
          id?: string
          learning_outcome?: string | null
          lesson_plan?: string | null
          schedule_id?: string
          session_status?: Database["public"]["Enums"]["session_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          department_id: string
          full_name: string
          gender: string | null
          id: string
          level_id: string
          registration_number: string
          section_id: string
          status: Database["public"]["Enums"]["entity_active"]
        }
        Insert: {
          created_at?: string
          department_id: string
          full_name: string
          gender?: string | null
          id?: string
          level_id: string
          registration_number: string
          section_id: string
          status?: Database["public"]["Enums"]["entity_active"]
        }
        Update: {
          created_at?: string
          department_id?: string
          full_name?: string
          gender?: string | null
          id?: string
          level_id?: string
          registration_number?: string
          section_id?: string
          status?: Database["public"]["Enums"]["entity_active"]
        }
        Relationships: [
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_registry: {
        Row: {
          created_at: string
          department_id: string
          email: string
          full_name: string
          hidden_staff_id: string
          id: string
          phone: string | null
          qualifications: string[]
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          department_id: string
          email: string
          full_name: string
          hidden_staff_id?: string
          id?: string
          phone?: string | null
          qualifications?: string[]
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          department_id?: string
          email?: string
          full_name?: string
          hidden_staff_id?: string
          id?: string
          phone?: string | null
          qualifications?: string[]
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "trainer_registry_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_skills: {
        Row: {
          created_at: string
          id: string
          module_code: string
          qualification_level: string
          trainer_registry_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_code: string
          qualification_level: string
          trainer_registry_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_code?: string
          qualification_level?: string
          trainer_registry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_skills_trainer_registry_id_fkey"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          capacity: number
          created_at: string
          geo_radius: number
          id: string
          latitude: number
          longitude: number
          name: string
          type: Database["public"]["Enums"]["venue_type"]
        }
        Insert: {
          capacity?: number
          created_at?: string
          geo_radius?: number
          id?: string
          latitude?: number
          longitude?: number
          name: string
          type?: Database["public"]["Enums"]["venue_type"]
        }
        Update: {
          capacity?: number
          created_at?: string
          geo_radius?: number
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          type?: Database["public"]["Enums"]["venue_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_department_id: { Args: never; Returns: string }
      current_trainer_registry_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_session_batch: {
        Args: {
          _attendance: Json
          _client_timestamp: string
          _client_uuid: string
          _latitude: number
          _learning_outcome: string
          _lesson_plan: string
          _longitude: number
          _schedule_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "MA" | "DH" | "T"
      entity_active: "ACTIVE" | "INACTIVE"
      entity_status: "ACTIVE" | "SUSPENDED"
      leave_status: "PENDING" | "APPROVED" | "REJECTED"
      level_name: "I" | "II" | "III" | "IV" | "V"
      module_type: "Theory" | "Practical" | "Both"
      notification_type: "PUSH" | "EMAIL" | "SMS" | "IN_APP"
      schedule_status:
        | "DRAFT"
        | "PENDING"
        | "FEEDBACK_REQUIRED"
        | "LIVE"
        | "COMPLETED"
        | "CANCELLED"
        | "ARCHIVED"
      semester_status: "ACTIVE" | "CLOSED" | "ARCHIVED"
      session_status: "LIVE" | "COMPLETED"
      venue_type: "Workshop" | "Lab" | "Classroom"
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
      app_role: ["MA", "DH", "T"],
      entity_active: ["ACTIVE", "INACTIVE"],
      entity_status: ["ACTIVE", "SUSPENDED"],
      leave_status: ["PENDING", "APPROVED", "REJECTED"],
      level_name: ["I", "II", "III", "IV", "V"],
      module_type: ["Theory", "Practical", "Both"],
      notification_type: ["PUSH", "EMAIL", "SMS", "IN_APP"],
      schedule_status: [
        "DRAFT",
        "PENDING",
        "FEEDBACK_REQUIRED",
        "LIVE",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
      ],
      semester_status: ["ACTIVE", "CLOSED", "ARCHIVED"],
      session_status: ["LIVE", "COMPLETED"],
      venue_type: ["Workshop", "Lab", "Classroom"],
    },
  },
} as const
