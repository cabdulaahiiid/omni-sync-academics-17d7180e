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
      ct_absence_events: {
        Row: {
          consecutive_days: number
          created_at: string
          from_date: string
          id: string
          parent_notified: boolean
          placement_id: string
          reason: string | null
          to_date: string
        }
        Insert: {
          consecutive_days: number
          created_at?: string
          from_date: string
          id?: string
          parent_notified?: boolean
          placement_id: string
          reason?: string | null
          to_date: string
        }
        Update: {
          consecutive_days?: number
          created_at?: string
          from_date?: string
          id?: string
          parent_notified?: boolean
          placement_id?: string
          reason?: string | null
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_absence_events_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_assessment_queue: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          occupation_id: string
          placement_id: string
          queued_by: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          occupation_id: string
          placement_id: string
          queued_by?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          occupation_id?: string
          placement_id?: string
          queued_by?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_assessment_queue_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: true
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_assessment_queue_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_assessment_queue_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_assessment_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_basic_competency_evaluations: {
        Row: {
          comment: string | null
          competency: string
          created_at: string
          evaluation_id: string
          id: string
          rating: Database["public"]["Enums"]["ct_competency_rating"]
        }
        Insert: {
          comment?: string | null
          competency: string
          created_at?: string
          evaluation_id: string
          id?: string
          rating: Database["public"]["Enums"]["ct_competency_rating"]
        }
        Update: {
          comment?: string | null
          competency?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          rating?: Database["public"]["Enums"]["ct_competency_rating"]
        }
        Relationships: [
          {
            foreignKeyName: "ct_basic_competency_evaluations_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_curriculum_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string | null
          id: string
          is_active: boolean
          occupation_id: string
          updated_at: string
          updated_by: string | null
          version_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          occupation_id: string
          updated_at?: string
          updated_by?: string | null
          version_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          occupation_id?: string
          updated_at?: string
          updated_by?: string | null
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_curriculum_versions_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_daily_logbook_entries: {
        Row: {
          client_uuid: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          hours: number
          id: string
          placement_id: string
          status: Database["public"]["Enums"]["ct_logbook_status"]
          submitted_at: string | null
          task_description: string
          task_id: string | null
          uc_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          entry_date: string
          hours: number
          id?: string
          placement_id: string
          status?: Database["public"]["Enums"]["ct_logbook_status"]
          submitted_at?: string | null
          task_description: string
          task_id?: string | null
          uc_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          hours?: number
          id?: string
          placement_id?: string
          status?: Database["public"]["Enums"]["ct_logbook_status"]
          submitted_at?: string | null
          task_description?: string
          task_id?: string | null
          uc_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_daily_logbook_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_daily_logbook_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ct_training_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_daily_logbook_entries_uc_id_fkey"
            columns: ["uc_id"]
            isOneToOne: false
            referencedRelation: "ct_units_of_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_daily_practical_logs: {
        Row: {
          attendance: Database["public"]["Enums"]["ct_attendance_status"]
          client_uuid: string | null
          created_at: string
          created_by: string | null
          gap_tags: string[]
          id: string
          log_date: string
          placement_id: string
          safety_breach: boolean
          safety_notes: string | null
          score: number | null
          shift_hours: number
          task_notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attendance?: Database["public"]["Enums"]["ct_attendance_status"]
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          gap_tags?: string[]
          id?: string
          log_date: string
          placement_id: string
          safety_breach?: boolean
          safety_notes?: string | null
          score?: number | null
          shift_hours?: number
          task_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attendance?: Database["public"]["Enums"]["ct_attendance_status"]
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          gap_tags?: string[]
          id?: string
          log_date?: string
          placement_id?: string
          safety_breach?: boolean
          safety_notes?: string | null
          score?: number | null
          shift_hours?: number
          task_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_daily_practical_logs_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_day1_checkins: {
        Row: {
          accuracy_meters: number | null
          checked_in_at: string
          created_at: string
          created_by: string | null
          device_info: string | null
          distance_meters: number | null
          geo_verified: boolean
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          placement_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          checked_in_at?: string
          created_at?: string
          created_by?: string | null
          device_info?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          placement_id: string
        }
        Update: {
          accuracy_meters?: number | null
          checked_in_at?: string
          created_at?: string
          created_by?: string | null
          device_info?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          placement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_day1_checkins_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: true
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_department_competencies: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          critical: boolean
          department_id: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          critical?: boolean
          department_id: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          critical?: boolean
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_department_competencies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_department_eval_configs: {
        Row: {
          attendance_threshold: number
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          max_allowed_gaps: number
          passing_threshold: number
          updated_at: string
          updated_by: string | null
          weight_daily: number
          weight_industry: number
          weight_tvet: number
        }
        Insert: {
          attendance_threshold?: number
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          max_allowed_gaps?: number
          passing_threshold?: number
          updated_at?: string
          updated_by?: string | null
          weight_daily?: number
          weight_industry?: number
          weight_tvet?: number
        }
        Update: {
          attendance_threshold?: number
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          max_allowed_gaps?: number
          passing_threshold?: number
          updated_at?: string
          updated_by?: string | null
          weight_daily?: number
          weight_industry?: number
          weight_tvet?: number
        }
        Relationships: [
          {
            foreignKeyName: "ct_department_eval_configs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_enterprise_contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string | null
          enterprise_id: string
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          role_title: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          enterprise_id: string
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          enterprise_id?: string
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_enterprise_contacts_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_enterprise_occupations: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          occupation_id: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          occupation_id: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          occupation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_enterprise_occupations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_enterprise_occupations_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_enterprise_training_sites: {
        Row: {
          active: boolean
          allowed_radius_meters: number | null
          created_at: string
          created_by: string | null
          enterprise_id: string
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          max_capacity: number | null
          name: string
          rehabilitation_work: string | null
          senior_engineer: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          allowed_radius_meters?: number | null
          created_at?: string
          created_by?: string | null
          enterprise_id: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          max_capacity?: number | null
          name: string
          rehabilitation_work?: string | null
          senior_engineer?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          allowed_radius_meters?: number | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          max_capacity?: number | null
          name?: string
          rehabilitation_work?: string | null
          senior_engineer?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_enterprise_training_sites_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_enterprises: {
        Row: {
          active: boolean
          address: string | null
          allowed_radius_meters: number
          code: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          max_capacity: number
          name: string
          phone: string | null
          sector: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          allowed_radius_meters?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_capacity?: number
          name: string
          phone?: string | null
          sector?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          allowed_radius_meters?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_capacity?: number
          name?: string
          phone?: string | null
          sector?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ct_final_evaluations: {
        Row: {
          attendance_rate: number | null
          calculation_version: number
          composite_score: number | null
          created_at: string
          daily_avg_score: number | null
          evaluator_id: string | null
          evaluator_name: string | null
          failed_uc_count: number
          finalized: boolean
          finalized_at: string | null
          id: string
          industry_score: number | null
          overall_comment: string | null
          placement_id: string
          recommendation:
            | Database["public"]["Enums"]["ct_recommendation"]
            | null
          red_competency_count: number
          remedial_hours: number
          safety_breach_count: number
          source: Database["public"]["Enums"]["ct_evaluator_source"]
          status_color: Database["public"]["Enums"]["ct_status_color"] | null
          tvet_score: number | null
          updated_at: string
          weights_used: Json | null
        }
        Insert: {
          attendance_rate?: number | null
          calculation_version?: number
          composite_score?: number | null
          created_at?: string
          daily_avg_score?: number | null
          evaluator_id?: string | null
          evaluator_name?: string | null
          failed_uc_count?: number
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          industry_score?: number | null
          overall_comment?: string | null
          placement_id: string
          recommendation?:
            | Database["public"]["Enums"]["ct_recommendation"]
            | null
          red_competency_count?: number
          remedial_hours?: number
          safety_breach_count?: number
          source: Database["public"]["Enums"]["ct_evaluator_source"]
          status_color?: Database["public"]["Enums"]["ct_status_color"] | null
          tvet_score?: number | null
          updated_at?: string
          weights_used?: Json | null
        }
        Update: {
          attendance_rate?: number | null
          calculation_version?: number
          composite_score?: number | null
          created_at?: string
          daily_avg_score?: number | null
          evaluator_id?: string | null
          evaluator_name?: string | null
          failed_uc_count?: number
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          industry_score?: number | null
          overall_comment?: string | null
          placement_id?: string
          recommendation?:
            | Database["public"]["Enums"]["ct_recommendation"]
            | null
          red_competency_count?: number
          remedial_hours?: number
          safety_breach_count?: number
          source?: Database["public"]["Enums"]["ct_evaluator_source"]
          status_color?: Database["public"]["Enums"]["ct_status_color"] | null
          tvet_score?: number | null
          updated_at?: string
          weights_used?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_final_evaluations_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_logbook_approvals: {
        Row: {
          comment: string | null
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["ct_logbook_status"]
          entry_id: string
          id: string
        }
        Insert: {
          comment?: string | null
          decided_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["ct_logbook_status"]
          entry_id: string
          id?: string
        }
        Update: {
          comment?: string | null
          decided_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["ct_logbook_status"]
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_logbook_approvals_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ct_daily_logbook_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_occupations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_occupations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_remedial_actions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string
          evaluation_id: string | null
          hours: number
          id: string
          placement_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description: string
          evaluation_id?: string | null
          hours?: number
          id?: string
          placement_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          evaluation_id?: string | null
          hours?: number
          id?: string
          placement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_remedial_actions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_remedial_actions_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_remediation_plans: {
        Row: {
          assigned_trainer_id: string | null
          completed: boolean
          created_at: string
          evaluation_id: string | null
          focus_areas: string[]
          hours: number
          id: string
          notes: string | null
          placement_id: string
          updated_at: string
        }
        Insert: {
          assigned_trainer_id?: string | null
          completed?: boolean
          created_at?: string
          evaluation_id?: string | null
          focus_areas?: string[]
          hours?: number
          id?: string
          notes?: string | null
          placement_id: string
          updated_at?: string
        }
        Update: {
          assigned_trainer_id?: string | null
          completed?: boolean
          created_at?: string
          evaluation_id?: string | null
          focus_areas?: string[]
          hours?: number
          id?: string
          notes?: string | null
          placement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_remediation_plans_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_remediation_plans_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_remediation_plans_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_request_decisions: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          comment: string | null
          created_at: string
          delegated_to: string | null
          department_id: string | null
          id: string
          new_status: Database["public"]["Enums"]["ct_request_status"] | null
          previous_status:
            | Database["public"]["Enums"]["ct_request_status"]
            | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          comment?: string | null
          created_at?: string
          delegated_to?: string | null
          department_id?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["ct_request_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["ct_request_status"]
            | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          comment?: string | null
          created_at?: string
          delegated_to?: string | null
          department_id?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["ct_request_status"] | null
          previous_status?:
            | Database["public"]["Enums"]["ct_request_status"]
            | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_request_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ct_training_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_request_delegations: {
        Row: {
          created_at: string
          delegated_by: string
          delegated_to: string
          id: string
          note: string | null
          request_id: string
        }
        Insert: {
          created_at?: string
          delegated_by: string
          delegated_to: string
          id?: string
          note?: string | null
          request_id: string
        }
        Update: {
          created_at?: string
          delegated_by?: string
          delegated_to?: string
          id?: string
          note?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_request_delegations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ct_training_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_settings: {
        Row: {
          absence_days_threshold: number
          calculation_version: number
          created_at: string
          id: string
          max_daily_logbook_hours: number
          max_red_competencies_for_assessment: number
          missing_logbook_counts_as_absence: boolean
          remedial_hours_per_failed_uc: number
          remedial_hours_per_red_competency: number
          theory_threshold_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          absence_days_threshold?: number
          calculation_version?: number
          created_at?: string
          id?: string
          max_daily_logbook_hours?: number
          max_red_competencies_for_assessment?: number
          missing_logbook_counts_as_absence?: boolean
          remedial_hours_per_failed_uc?: number
          remedial_hours_per_red_competency?: number
          theory_threshold_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          absence_days_threshold?: number
          calculation_version?: number
          created_at?: string
          id?: string
          max_daily_logbook_hours?: number
          max_red_competencies_for_assessment?: number
          missing_logbook_counts_as_absence?: boolean
          remedial_hours_per_failed_uc?: number
          remedial_hours_per_red_competency?: number
          theory_threshold_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ct_skill_gaps: {
        Row: {
          competency: string | null
          created_at: string
          detail: string | null
          evaluation_id: string | null
          gap_type: string
          id: string
          placement_id: string
          severity: Database["public"]["Enums"]["ct_gap_severity"]
          tag: string | null
          uc_id: string | null
        }
        Insert: {
          competency?: string | null
          created_at?: string
          detail?: string | null
          evaluation_id?: string | null
          gap_type: string
          id?: string
          placement_id: string
          severity?: Database["public"]["Enums"]["ct_gap_severity"]
          tag?: string | null
          uc_id?: string | null
        }
        Update: {
          competency?: string | null
          created_at?: string
          detail?: string | null
          evaluation_id?: string | null
          gap_type?: string
          id?: string
          placement_id?: string
          severity?: Database["public"]["Enums"]["ct_gap_severity"]
          tag?: string | null
          uc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_skill_gaps_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_skill_gaps_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_skill_gaps_uc_id_fkey"
            columns: ["uc_id"]
            isOneToOne: false
            referencedRelation: "ct_units_of_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_sms_delivery_logs: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          sms_id: string
          status: Database["public"]["Enums"]["ct_sms_status"]
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          sms_id: string
          status: Database["public"]["Enums"]["ct_sms_status"]
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          sms_id?: string
          status?: Database["public"]["Enums"]["ct_sms_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ct_sms_delivery_logs_sms_id_fkey"
            columns: ["sms_id"]
            isOneToOne: false
            referencedRelation: "ct_sms_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_sms_queue: {
        Row: {
          created_at: string
          delivered_at: string | null
          error: string | null
          id: string
          message: string
          phone: string
          placement_id: string | null
          provider_message_id: string | null
          reason: string | null
          recipient_name: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["ct_sms_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          message: string
          phone: string
          placement_id?: string | null
          provider_message_id?: string | null
          reason?: string | null
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["ct_sms_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          message?: string
          phone?: string
          placement_id?: string | null
          provider_message_id?: string | null
          reason?: string | null
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["ct_sms_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_sms_queue_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_sms_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_student_placements: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          end_date: string
          enterprise_id: string
          id: string
          locked: boolean
          mentor_contact_id: string | null
          occupation_id: string
          request_id: string
          schedule_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["ct_placement_status"]
          student_id: string
          training_site_id: string | null
          updated_at: string
          updated_by: string | null
          visiting_trainer_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          end_date: string
          enterprise_id: string
          id?: string
          locked?: boolean
          mentor_contact_id?: string | null
          occupation_id: string
          request_id: string
          schedule_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["ct_placement_status"]
          student_id: string
          training_site_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visiting_trainer_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          end_date?: string
          enterprise_id?: string
          id?: string
          locked?: boolean
          mentor_contact_id?: string | null
          occupation_id?: string
          request_id?: string
          schedule_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["ct_placement_status"]
          student_id?: string
          training_site_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visiting_trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_student_placements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_mentor_contact_id_fkey"
            columns: ["mentor_contact_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprise_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ct_training_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "ct_training_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_training_site_id_fkey"
            columns: ["training_site_id"]
            isOneToOne: false
            referencedRelation: "ct_enterprise_training_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_student_placements_visiting_trainer_id_fkey"
            columns: ["visiting_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_supervision_evidence: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          storage_path: string
          uploaded_by: string | null
          visit_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path: string
          uploaded_by?: string | null
          visit_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          uploaded_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_supervision_evidence_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "ct_supervision_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_supervision_visits: {
        Row: {
          actions: string | null
          created_at: string
          distance_meters: number | null
          findings: string | null
          geo_verified: boolean
          id: string
          latitude: number | null
          longitude: number | null
          placement_id: string
          updated_at: string
          visit_date: string
          visited_by: string
        }
        Insert: {
          actions?: string | null
          created_at?: string
          distance_meters?: number | null
          findings?: string | null
          geo_verified?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          placement_id: string
          updated_at?: string
          visit_date: string
          visited_by: string
        }
        Update: {
          actions?: string | null
          created_at?: string
          distance_meters?: number | null
          findings?: string | null
          geo_verified?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          placement_id?: string
          updated_at?: string
          visit_date?: string
          visited_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_supervision_visits_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ct_student_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_training_modules: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          created_by: string | null
          curriculum_version_id: string | null
          erp_module_id: string | null
          id: string
          level_id: string | null
          name: string
          occupation_id: string
          sequence: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_version_id?: string | null
          erp_module_id?: string | null
          id?: string
          level_id?: string | null
          name: string
          occupation_id: string
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_version_id?: string | null
          erp_module_id?: string | null
          id?: string
          level_id?: string | null
          name?: string
          occupation_id?: string
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_training_modules_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "ct_curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_modules_erp_module_id_fkey"
            columns: ["erp_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_modules_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_modules_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_training_request_students: {
        Row: {
          created_at: string
          eligible: boolean
          id: string
          manual_override: boolean
          override_reason: string | null
          request_id: string
          student_id: string
          theory_percent: number | null
        }
        Insert: {
          created_at?: string
          eligible?: boolean
          id?: string
          manual_override?: boolean
          override_reason?: string | null
          request_id: string
          student_id: string
          theory_percent?: number | null
        }
        Update: {
          created_at?: string
          eligible?: boolean
          id?: string
          manual_override?: boolean
          override_reason?: string | null
          request_id?: string
          student_id?: string
          theory_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_training_request_students_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ct_training_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_request_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_training_requests: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decision_note: string | null
          department_id: string
          id: string
          initiation_note: string | null
          ips_actor_id: string | null
          level_id: string | null
          manual_initiation: boolean
          notes: string | null
          occupation_id: string
          pd_actor_id: string | null
          reference: string | null
          requested_end_date: string
          requested_start_date: string
          section_id: string | null
          status: Database["public"]["Enums"]["ct_request_status"]
          submitted_at: string | null
          submitted_by: string | null
          title: string
          training_module_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          department_id: string
          id?: string
          initiation_note?: string | null
          ips_actor_id?: string | null
          level_id?: string | null
          manual_initiation?: boolean
          notes?: string | null
          occupation_id: string
          pd_actor_id?: string | null
          reference?: string | null
          requested_end_date: string
          requested_start_date: string
          section_id?: string | null
          status?: Database["public"]["Enums"]["ct_request_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          training_module_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          department_id?: string
          id?: string
          initiation_note?: string | null
          ips_actor_id?: string | null
          level_id?: string | null
          manual_initiation?: boolean
          notes?: string | null
          occupation_id?: string
          pd_actor_id?: string | null
          reference?: string | null
          requested_end_date?: string
          requested_start_date?: string
          section_id?: string | null
          status?: Database["public"]["Enums"]["ct_request_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          training_module_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ct_training_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_requests_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_requests_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "ct_occupations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_training_requests_training_module_id_fkey"
            columns: ["training_module_id"]
            isOneToOne: false
            referencedRelation: "ct_training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_training_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          daily_hours: number
          days_per_week: number
          end_date: string
          id: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          request_id: string
          start_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_hours?: number
          days_per_week?: number
          end_date: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          request_id: string
          start_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_hours?: number
          days_per_week?: number
          end_date?: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          request_id?: string
          start_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_training_schedules_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ct_training_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_training_tasks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          sequence: number
          uc_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sequence?: number
          uc_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sequence?: number
          uc_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_training_tasks_uc_id_fkey"
            columns: ["uc_id"]
            isOneToOne: false
            referencedRelation: "ct_units_of_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_uc_evaluations: {
        Row: {
          comment: string | null
          created_at: string
          evaluation_id: string
          id: string
          result: Database["public"]["Enums"]["ct_uc_result"]
          uc_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          result: Database["public"]["Enums"]["ct_uc_result"]
          uc_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          result?: Database["public"]["Enums"]["ct_uc_result"]
          uc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_uc_evaluations_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "ct_final_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_uc_evaluations_uc_id_fkey"
            columns: ["uc_id"]
            isOneToOne: false
            referencedRelation: "ct_units_of_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_units_of_competence: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          sequence: number
          training_module_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sequence?: number
          training_module_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sequence?: number
          training_module_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_units_of_competence_training_module_id_fkey"
            columns: ["training_module_id"]
            isOneToOne: false
            referencedRelation: "ct_training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_workflow_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
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
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          telephone: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          telephone?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          telephone?: string | null
        }
        Relationships: []
      }
      external_contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          department_id: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          role_title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_contacts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
          phone: string | null
          student_id: string | null
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
          phone?: string | null
          student_id?: string | null
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
          phone?: string | null
          student_id?: string | null
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
            foreignKeyName: "profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      schedule_plans: {
        Row: {
          created_at: string
          created_by: string | null
          delivery: string
          department_id: string
          end_date: string | null
          id: string
          level_id: string
          module_code: string
          module_id: string
          module_name: string
          module_total_minutes: number
          practical_days: string[]
          section_id: string
          semester_id: string
          session_minutes: number
          sessions_per_week: number
          start_date: string
          start_time: string
          theory_days: string[]
          total_minutes: number
          total_sessions: number
          trainer_registry_id: string
          updated_at: string
          venue_id: string
          weeks: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery?: string
          department_id: string
          end_date?: string | null
          id?: string
          level_id: string
          module_code: string
          module_id: string
          module_name: string
          module_total_minutes: number
          practical_days?: string[]
          section_id: string
          semester_id: string
          session_minutes: number
          sessions_per_week?: number
          start_date: string
          start_time: string
          theory_days?: string[]
          total_minutes?: number
          total_sessions?: number
          trainer_registry_id: string
          updated_at?: string
          venue_id: string
          weeks?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery?: string
          department_id?: string
          end_date?: string | null
          id?: string
          level_id?: string
          module_code?: string
          module_id?: string
          module_name?: string
          module_total_minutes?: number
          practical_days?: string[]
          section_id?: string
          semester_id?: string
          session_minutes?: number
          sessions_per_week?: number
          start_date?: string
          start_time?: string
          theory_days?: string[]
          total_minutes?: number
          total_sessions?: number
          trainer_registry_id?: string
          updated_at?: string
          venue_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semester_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_trainer_registry_id_fkey"
            columns: ["trainer_registry_id"]
            isOneToOne: false
            referencedRelation: "trainer_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          plan_id: string | null
          published_at: string | null
          published_by: string | null
          section_id: string
          semester_id: string
          session_number: number | null
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
          plan_id?: string | null
          published_at?: string | null
          published_by?: string | null
          section_id: string
          semester_id: string
          session_number?: number | null
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
          plan_id?: string | null
          published_at?: string | null
          published_by?: string | null
          section_id?: string
          semester_id?: string
          session_number?: number | null
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
            foreignKeyName: "schedules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "schedule_plans"
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
      sms_campaigns: {
        Row: {
          claimed_at: string | null
          created_at: string
          environment: string | null
          error: string | null
          failed_count: number
          filters: Json
          groups: string[]
          id: string
          message: string
          scheduled_at: string | null
          sender_id: string | null
          sender_name: string | null
          sent_count: number
          status: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          environment?: string | null
          error?: string | null
          failed_count?: number
          filters?: Json
          groups?: string[]
          id?: string
          message: string
          scheduled_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sent_count?: number
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          environment?: string | null
          error?: string | null
          failed_count?: number
          filters?: Json
          groups?: string[]
          id?: string
          message?: string
          scheduled_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sent_count?: number
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_recipients: {
        Row: {
          campaign_id: string
          contact_name: string | null
          created_at: string
          error: string | null
          id: string
          phone: string
          provider_message_id: string | null
          source_group: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_name?: string | null
          created_at?: string
          error?: string | null
          id?: string
          phone: string
          provider_message_id?: string | null
          source_group?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_name?: string | null
          created_at?: string
          error?: string | null
          id?: string
          phone?: string
          provider_message_id?: string | null
          source_group?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_scheduled_recipients: {
        Row: {
          campaign_id: string
          contact_name: string | null
          created_at: string
          id: string
          phone: string
          source_group: string | null
        }
        Insert: {
          campaign_id: string
          contact_name?: string | null
          created_at?: string
          id?: string
          phone: string
          source_group?: string | null
        }
        Update: {
          campaign_id?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          phone?: string
          source_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_scheduled_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          api_key: string | null
          created_at: string
          dev_base_url: string
          environment: string
          id: string
          prod_base_url: string
          sender_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          dev_base_url?: string
          environment?: string
          id?: string
          prod_base_url?: string
          sender_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          dev_base_url?: string
          environment?: string
          id?: string
          prod_base_url?: string
          sender_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          telephone: string | null
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
          telephone?: string | null
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
          telephone?: string | null
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
          staff_code: string | null
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
          staff_code?: string | null
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
          staff_code?: string | null
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
      admin_create_user_records: {
        Args: {
          _avatar_path: string
          _department_id: string
          _email: string
          _full_name: string
          _phone: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      admin_delete_department: {
        Args: { _confirm_name: string; _department_id: string }
        Returns: Json
      }
      admin_department_delete_preview: {
        Args: { _department_id: string }
        Returns: Json
      }
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
      ct_actor_role_label: { Args: never; Returns: string }
      ct_allocate_roster: {
        Args: { _allocations: Json; _request_id: string; _schedule: Json }
        Returns: Json
      }
      ct_assert_version: {
        Args: { _current: number; _expected: number }
        Returns: undefined
      }
      ct_can_access_department: {
        Args: { _department_id: string }
        Returns: boolean
      }
      ct_can_manage_master: { Args: never; Returns: boolean }
      ct_can_view_placement: {
        Args: { _placement_id: string }
        Returns: boolean
      }
      ct_checkin_day1: {
        Args: {
          _accuracy: number
          _device: string
          _lat: number
          _lng: number
          _placement_id: string
        }
        Returns: Json
      }
      ct_create_request: {
        Args: { _payload: Json; _student_ids: string[] }
        Returns: string
      }
      ct_delegate_request: {
        Args: { _note: string; _request_id: string; _to_user: string }
        Returns: undefined
      }
      ct_detect_absences: { Args: { _placement_id: string }; Returns: Json }
      ct_finalize_evaluation: {
        Args: { _evaluation_id: string }
        Returns: Json
      }
      ct_finalize_roster: { Args: { _request_id: string }; Returns: Json }
      ct_industrial_department_id: { Args: never; Returns: string }
      ct_ips_decide_request: {
        Args: {
          _comment: string
          _decision: string
          _expected_version?: number
          _request_id: string
        }
        Returns: Json
      }
      ct_ips_delegate_request: {
        Args: {
          _expected_version?: number
          _note: string
          _request_id: string
          _to_user: string
        }
        Returns: undefined
      }
      ct_ips_hold_request: {
        Args: {
          _expected_version?: number
          _hold_reason: string
          _request_id: string
        }
        Returns: Json
      }
      ct_ips_modify_request: {
        Args: {
          _end_date: string
          _expected_version?: number
          _note: string
          _request_id: string
          _start_date: string
          _training_module_id: string
        }
        Returns: Json
      }
      ct_ips_start_review: {
        Args: { _expected_version?: number; _request_id: string }
        Returns: undefined
      }
      ct_is_admin: { Args: never; Returns: boolean }
      ct_is_industrial_dh: { Args: never; Returns: boolean }
      ct_is_ips: { Args: never; Returns: boolean }
      ct_is_placement_mentor: {
        Args: { _placement_id: string }
        Returns: boolean
      }
      ct_is_placement_trainee: {
        Args: { _placement_id: string }
        Returns: boolean
      }
      ct_is_program_director: { Args: never; Returns: boolean }
      ct_is_staff: { Args: never; Returns: boolean }
      ct_log_event: {
        Args: {
          _entity_id: string
          _entity_type: string
          _event: string
          _payload: Json
        }
        Returns: undefined
      }
      ct_mentor_decide_logbook: {
        Args: {
          _comment: string
          _decision: Database["public"]["Enums"]["ct_logbook_status"]
          _entry_id: string
        }
        Returns: undefined
      }
      ct_mentor_enterprise_ids: { Args: never; Returns: string[] }
      ct_my_student_id: { Args: never; Returns: string }
      ct_pd_bulk_return_to_ips: {
        Args: {
          _expected_versions?: Json
          _note: string
          _request_ids: string[]
        }
        Returns: Json
      }
      ct_pd_decide_request: {
        Args: {
          _comment: string
          _decision: string
          _expected_version?: number
          _request_id: string
        }
        Returns: Json
      }
      ct_pd_has_request: { Args: { _request_id: string }; Returns: boolean }
      ct_pd_start_review: {
        Args: { _expected_version?: number; _request_id: string }
        Returns: undefined
      }
      ct_push_to_assessment: {
        Args: { _evaluation_id: string }
        Returns: string
      }
      ct_record_decision: {
        Args: {
          _action: string
          _comment: string
          _delegated_to: string
          _new: Database["public"]["Enums"]["ct_request_status"]
          _prev: Database["public"]["Enums"]["ct_request_status"]
          _request_id: string
        }
        Returns: undefined
      }
      ct_record_supervision: {
        Args: {
          _actions: string
          _findings: string
          _lat: number
          _lng: number
          _placement_id: string
          _visit_date: string
        }
        Returns: string
      }
      ct_require_any: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: undefined
      }
      ct_submit_daily_log: {
        Args: {
          _attendance: Database["public"]["Enums"]["ct_attendance_status"]
          _client_uuid: string
          _gap_tags: string[]
          _log_date: string
          _placement_id: string
          _safety_breach: boolean
          _safety_notes: string
          _score: number
          _shift_hours: number
          _task_notes: string
        }
        Returns: Json
      }
      ct_submit_evaluation: {
        Args: {
          _comment: string
          _competencies: Json
          _placement_id: string
          _source: Database["public"]["Enums"]["ct_evaluator_source"]
          _uc_results: Json
        }
        Returns: string
      }
      ct_submit_logbook_day: {
        Args: {
          _client_uuid: string
          _entry_date: string
          _hours: number
          _placement_id: string
          _task_description: string
          _task_id: string
          _uc_id: string
        }
        Returns: Json
      }
      ct_submit_request: { Args: { _request_id: string }; Returns: undefined }
      ct_upsert_department_config: {
        Args: {
          _attendance_threshold: number
          _department_id: string
          _max_allowed_gaps: number
          _passing_threshold: number
          _weight_daily: number
          _weight_industry: number
          _weight_tvet: number
        }
        Returns: string
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
      dh_save_schedule_plan: {
        Args: { _plan: Json; _plan_id?: string; _sessions: Json }
        Returns: Json
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
      next_entity_code: {
        Args: { _department_id: string; _kind: string }
        Returns: string
      }
      phone_owner: {
        Args: { _phone: string }
        Returns: {
          id: string
          kind: string
          name: string
        }[]
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
      app_role: "MA" | "DH" | "T" | "PD" | "CO" | "VT" | "EM" | "TR" | "IPS"
      approval_decision: "pending" | "approved" | "rejected"
      approval_type: "semester" | "session"
      ct_attendance_status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED"
      ct_competency_rating: "GREEN" | "YELLOW" | "RED"
      ct_evaluator_source: "TRAINER" | "MENTOR"
      ct_gap_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      ct_logbook_status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
      ct_placement_status:
        | "PENDING"
        | "CONFIRMED"
        | "ACTIVE"
        | "COMPLETED"
        | "WITHDRAWN"
      ct_recommendation:
        | "READY_FOR_ASSESSMENT"
        | "REMEDIAL_REQUIRED"
        | "REPEAT_PLACEMENT"
      ct_request_status:
        | "DRAFT"
        | "SUBMITTED"
        | "DELEGATED"
        | "ALLOCATED"
        | "SCHEDULED"
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED"
        | "PENDING_APPROVAL"
        | "UNDER_IPS_REVIEW"
        | "DELEGATED_TO_PD"
        | "PD_REVIEW"
        | "PD_APPROVED"
        | "IPS_FINAL_APPROVAL"
        | "APPROVED"
        | "REJECTED"
        | "RETURNED_FOR_CORRECTION"
        | "ON_HOLD"
        | "MODIFIED"
      ct_sms_status: "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "FAILED"
      ct_status_color: "GREEN" | "YELLOW" | "RED"
      ct_uc_result: "P" | "NP"
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
      app_role: ["MA", "DH", "T", "PD", "CO", "VT", "EM", "TR", "IPS"],
      approval_decision: ["pending", "approved", "rejected"],
      approval_type: ["semester", "session"],
      ct_attendance_status: ["PRESENT", "LATE", "ABSENT", "EXCUSED"],
      ct_competency_rating: ["GREEN", "YELLOW", "RED"],
      ct_evaluator_source: ["TRAINER", "MENTOR"],
      ct_gap_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      ct_logbook_status: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
      ct_placement_status: [
        "PENDING",
        "CONFIRMED",
        "ACTIVE",
        "COMPLETED",
        "WITHDRAWN",
      ],
      ct_recommendation: [
        "READY_FOR_ASSESSMENT",
        "REMEDIAL_REQUIRED",
        "REPEAT_PLACEMENT",
      ],
      ct_request_status: [
        "DRAFT",
        "SUBMITTED",
        "DELEGATED",
        "ALLOCATED",
        "SCHEDULED",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "PENDING_APPROVAL",
        "UNDER_IPS_REVIEW",
        "DELEGATED_TO_PD",
        "PD_REVIEW",
        "PD_APPROVED",
        "IPS_FINAL_APPROVAL",
        "APPROVED",
        "REJECTED",
        "RETURNED_FOR_CORRECTION",
        "ON_HOLD",
        "MODIFIED",
      ],
      ct_sms_status: ["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED"],
      ct_status_color: ["GREEN", "YELLOW", "RED"],
      ct_uc_result: ["P", "NP"],
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
