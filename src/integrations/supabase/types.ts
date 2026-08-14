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
          comment: string | null
          conflict_trainer: boolean
          conflict_venue: boolean
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          excessive_load: boolean
          id: string
          invalid_qualification: boolean
          schedule_id: string | null
          submitted_by: string | null
          target_id: string | null
          type: Database["public"]["Enums"]["approval_type"]
        }
        Insert: {
          comment?: string | null
          conflict_trainer?: boolean
          conflict_venue?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          excessive_load?: boolean
          id?: string
          invalid_qualification?: boolean
          schedule_id?: string | null
          submitted_by?: string | null
          target_id?: string | null
          type?: Database["public"]["Enums"]["approval_type"]
        }
        Update: {
          comment?: string | null
          conflict_trainer?: boolean
          conflict_venue?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          excessive_load?: boolean
          id?: string
          invalid_qualification?: boolean
          schedule_id?: string | null
          submitted_by?: string | null
          target_id?: string | null
          type?: Database["public"]["Enums"]["approval_type"]
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
      auth_events: {
        Row: {
          attempts: number | null
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          meta: Json | null
          ok: boolean | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind: string
          meta?: Json | null
          ok?: boolean | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          meta?: Json | null
          ok?: boolean | null
          reason?: string | null
          user_id?: string | null
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
          campus_lat: number | null
          campus_lng: number | null
          campus_radius_m: number
          geo_fence_radius: number
          geofence_enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_offline_sync?: boolean
          attendance_window_minutes?: number
          campus_lat?: number | null
          campus_lng?: number | null
          campus_radius_m?: number
          geo_fence_radius?: number
          geofence_enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_offline_sync?: boolean
          attendance_window_minutes?: number
          campus_lat?: number | null
          campus_lng?: number | null
          campus_radius_m?: number
          geo_fence_radius?: number
          geofence_enabled?: boolean
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
          display_name: string | null
          id: string
          name: Database["public"]["Enums"]["level_name"]
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          department_id: string
          display_name?: string | null
          id?: string
          name: Database["public"]["Enums"]["level_name"]
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          department_id?: string
          display_name?: string | null
          id?: string
          name?: Database["public"]["Enums"]["level_name"]
          status?: Database["public"]["Enums"]["entity_status"]
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
          avatar_path: string | null
          bypass_geofence: boolean
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          trainer_registry_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_path?: string | null
          bypass_geofence?: boolean
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string
          id: string
          trainer_registry_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_path?: string | null
          bypass_geofence?: boolean
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
      schedule_feedback_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_feedback_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_feedback_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "schedule_feedback_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_feedback_threads: {
        Row: {
          admin_id: string | null
          created_at: string
          department_id: string | null
          dh_id: string | null
          id: string
          semester_id: string
          week_num: number | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          department_id?: string | null
          dh_id?: string | null
          id?: string
          semester_id: string
          week_num?: number | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          department_id?: string | null
          dh_id?: string | null
          id?: string
          semester_id?: string
          week_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_feedback_threads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_feedback_threads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_feedback_threads_dh_id_fkey"
            columns: ["dh_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_feedback_threads_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semester_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          admin_feedback: string | null
          attendance_locked_at: string | null
          checkin_at: string | null
          created_at: string
          created_by: string | null
          date: string
          day: string
          department_id: string
          end_time: string
          ended_at: string | null
          hidden_staff_id: string
          id: string
          is_published: boolean
          level_id: string
          mode: Database["public"]["Enums"]["session_mode"] | null
          module_code: string
          module_name: string
          published_at: string | null
          published_by: string | null
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
          attendance_locked_at?: string | null
          checkin_at?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          day: string
          department_id: string
          end_time: string
          ended_at?: string | null
          hidden_staff_id: string
          id?: string
          is_published?: boolean
          level_id: string
          mode?: Database["public"]["Enums"]["session_mode"] | null
          module_code: string
          module_name: string
          published_at?: string | null
          published_by?: string | null
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
          attendance_locked_at?: string | null
          checkin_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          day?: string
          department_id?: string
          end_time?: string
          ended_at?: string | null
          hidden_staff_id?: string
          id?: string
          is_published?: boolean
          level_id?: string
          mode?: Database["public"]["Enums"]["session_mode"] | null
          module_code?: string
          module_name?: string
          published_at?: string | null
          published_by?: string | null
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
          approved_at: string | null
          approved_by: string | null
          created_at: string
          distribution_status: string
          end_date: string
          id: string
          name: string
          source_file_url: string | null
          start_date: string
          status: Database["public"]["Enums"]["semester_status"]
          uploaded_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          distribution_status?: string
          end_date: string
          id?: string
          name: string
          source_file_url?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["semester_status"]
          uploaded_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          distribution_status?: string
          end_date?: string
          id?: string
          name?: string
          source_file_url?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["semester_status"]
          uploaded_by?: string | null
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
          parent_guardian_name: string | null
          parent_guardian_relationship: string | null
          parent_guardian_telephone: string | null
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
          parent_guardian_name?: string | null
          parent_guardian_relationship?: string | null
          parent_guardian_telephone?: string | null
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
          parent_guardian_name?: string | null
          parent_guardian_relationship?: string | null
          parent_guardian_telephone?: string | null
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
      trainer_departments: {
        Row: {
          created_at: string
          department_id: string
          is_primary: boolean
          trainer_registry_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          is_primary?: boolean
          trainer_registry_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          is_primary?: boolean
          trainer_registry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_departments_trainer_registry_id_fkey"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
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
          sessions_completed: number
          sessions_target: number
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
          sessions_completed?: number
          sessions_target?: number
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
          sessions_completed?: number
          sessions_target?: number
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
      admin_set_dh_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: undefined
      }
      admin_set_trainer_departments: {
        Args: {
          _department_ids: string[]
          _primary_id: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_update_user_roles: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: undefined
      }
      current_department_id: { Args: never; Returns: string }
      current_trainer_registry_id: { Args: never; Returns: string }
      decide_approval: {
        Args: {
          _comment: string
          _decision: Database["public"]["Enums"]["approval_decision"]
          _id: string
        }
        Returns: undefined
      }
      dh_delete_draft_session: {
        Args: { _schedule_id: string }
        Returns: undefined
      }
      dh_override_attendance: {
        Args: {
          _attendance_log_id: string
          _audit_comment: string
          _new_value: boolean
        }
        Returns: undefined
      }
      dh_reply_feedback: {
        Args: { _message: string; _thread_id: string }
        Returns: string
      }
      dh_resubmit_semester: {
        Args: { _semester_id: string }
        Returns: undefined
      }
      dh_resubmit_week: {
        Args: { _semester_id: string; _week_num: number }
        Returns: number
      }
      dh_submit_semester_per_week: {
        Args: { _semester_id: string }
        Returns: Json
      }
      dh_swap_trainer: {
        Args: { _new_trainer: string; _reason: string; _schedule_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_trainer_login: {
        Args: { _department_id?: string; _profile_id: string }
        Returns: string
      }
      ma_decide_week: {
        Args: {
          _decision: Database["public"]["Enums"]["approval_decision"]
          _department_id: string
          _message: string
          _week_num: number
        }
        Returns: Json
      }
      ma_delete_schedule: {
        Args: { _reason: string; _schedule_id: string }
        Returns: Json
      }
      ma_reject_semester_with_feedback: {
        Args: { _message: string; _semester_id: string }
        Returns: string
      }
      ma_split_semester_to_weeks: {
        Args: { _approval_id: string }
        Returns: Json
      }
      reset_academic_data: { Args: never; Returns: Json }
      set_session_mode: {
        Args: {
          _mode: Database["public"]["Enums"]["session_mode"]
          _schedule_id: string
        }
        Returns: undefined
      }
      submit_for_approval: {
        Args: {
          _target_ids: string[]
          _type: Database["public"]["Enums"]["approval_type"]
        }
        Returns: number
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
      trainer_checkin: {
        Args: { _latitude: number; _longitude: number; _schedule_id: string }
        Returns: Json
      }
      trainer_end_session: {
        Args: {
          _learning_outcome: string
          _lesson_plan: string
          _schedule_id: string
        }
        Returns: Json
      }
      wipe_entire_system: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "MA" | "DH" | "T"
      approval_decision: "pending" | "approved" | "rejected"
      approval_type: "semester" | "session"
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
        | "PENDING_MA"
        | "ACTIVE"
        | "ENDED"
      semester_status:
        | "ACTIVE"
        | "CLOSED"
        | "ARCHIVED"
        | "DRAFT"
        | "PENDING_MA"
        | "LIVE"
        | "ENDED"
      session_mode: "Theory" | "Practical" | "Both"
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
      approval_decision: ["pending", "approved", "rejected"],
      approval_type: ["semester", "session"],
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
        "PENDING_MA",
        "ACTIVE",
        "ENDED",
      ],
      semester_status: [
        "ACTIVE",
        "CLOSED",
        "ARCHIVED",
        "DRAFT",
        "PENDING_MA",
        "LIVE",
        "ENDED",
      ],
      session_mode: ["Theory", "Practical", "Both"],
      session_status: ["LIVE", "COMPLETED"],
      venue_type: ["Workshop", "Lab", "Classroom"],
    },
  },
} as const
