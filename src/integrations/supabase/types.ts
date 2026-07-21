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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          is_demo: boolean
          meta: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          is_demo?: boolean
          meta?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          is_demo?: boolean
          meta?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_branding: {
        Row: {
          accent_color: string
          address: string | null
          created_at: string
          description: string | null
          email: string | null
          email_signature: string | null
          favicon_url: string | null
          id: string
          is_active: boolean
          letterhead_url: string | null
          login_bg_url: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_address: string | null
          primary_color: string
          report_footer: string | null
          report_header: string | null
          secondary_color: string
          short_name: string
          slogan: string | null
          social_links: Json
          updated_at: string
          website: string | null
          welcome_banner_url: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          email_signature?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          letterhead_url?: string | null
          login_bg_url?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_address?: string | null
          primary_color?: string
          report_footer?: string | null
          report_header?: string | null
          secondary_color?: string
          short_name?: string
          slogan?: string | null
          social_links?: Json
          updated_at?: string
          website?: string | null
          welcome_banner_url?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          email_signature?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          letterhead_url?: string | null
          login_bg_url?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_address?: string | null
          primary_color?: string
          report_footer?: string | null
          report_header?: string | null
          secondary_color?: string
          short_name?: string
          slogan?: string | null
          social_links?: Json
          updated_at?: string
          website?: string | null
          welcome_banner_url?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          date_employed: string | null
          department_id: string | null
          email: string
          employee_code: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_demo: boolean
          leave_balance: number
          phone: string | null
          position_id: string | null
          profile_picture_url: string | null
          section_id: string | null
          status: Database["public"]["Enums"]["employee_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_employed?: string | null
          department_id?: string | null
          email: string
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_demo?: boolean
          leave_balance?: number
          phone?: string | null
          position_id?: string | null
          profile_picture_url?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_employed?: string | null
          department_id?: string | null
          email?: string
          employee_code?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          is_demo?: boolean
          leave_balance?: number
          phone?: string | null
          position_id?: string | null
          profile_picture_url?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["leave_status"] | null
          id: string
          leave_request_id: string
          to_status: Database["public"]["Enums"]["leave_status"] | null
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_id: string
          approver_role: Database["public"]["Enums"]["app_role"]
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["leave_status"] | null
          id?: string
          leave_request_id: string
          to_status?: Database["public"]["Enums"]["leave_status"] | null
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          approver_id?: string
          approver_role?: Database["public"]["Enums"]["app_role"]
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["leave_status"] | null
          id?: string
          leave_request_id?: string
          to_status?: Database["public"]["Enums"]["leave_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_approvals_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          leave_request_id: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          leave_request_id: string
          mime_type: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          leave_request_id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_documents_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        Insert: {
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          department_id?: string | null
          employee_id: string
          end_date: string
          holiday_days?: number
          id?: string
          is_demo?: boolean
          leave_type_id: string
          reason?: string | null
          rejected_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          submitted_at?: string | null
          supervisor_id?: string | null
          total_calendar_days?: number
          updated_at?: string
          weekend_days?: number
          working_days?: number
        }
        Update: {
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          department_id?: string | null
          employee_id?: string
          end_date?: string
          holiday_days?: number
          id?: string
          is_demo?: boolean
          leave_type_id?: string
          reason?: string | null
          rejected_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          submitted_at?: string | null
          supervisor_id?: string | null
          total_calendar_days?: number
          updated_at?: string
          weekend_days?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          default_days: number
          description: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          name: string
          requires_document: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name: string
          requires_document?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name?: string
          requires_document?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_demo: boolean
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _meta: Json
        }
        Returns: undefined
      }
      _hr_officer_ids: { Args: never; Returns: string[] }
      _notify: {
        Args: { _body: string; _link: string; _title: string; _user: string }
        Returns: undefined
      }
      approve_leave_request: {
        Args: { _comment: string; _id: string }
        Returns: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_working_days: {
        Args: { _end: string; _start: string }
        Returns: {
          calendar_days: number
          holiday_days: number
          weekend_days: number
          working_days: number
        }[]
      }
      cancel_leave_request: {
        Args: { _id: string }
        Returns: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dept_head_of: { Args: { _department_id: string }; Returns: boolean }
      reject_leave_request: {
        Args: { _comment: string; _id: string }
        Returns: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_leave_changes: {
        Args: { _comment: string; _id: string }
        Returns: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_leave_request: {
        Args: { _id: string }
        Returns: {
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          end_date: string
          holiday_days: number
          id: string
          is_demo: boolean
          leave_type_id: string
          reason: string | null
          rejected_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          submitted_at: string | null
          supervisor_id: string | null
          total_calendar_days: number
          updated_at: string
          weekend_days: number
          working_days: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "system_admin"
        | "hr_officer"
        | "dept_head"
        | "supervisor"
        | "employee"
      approval_action:
        | "submit"
        | "approve"
        | "reject"
        | "request_changes"
        | "cancel"
        | "comment"
      employee_status: "active" | "inactive" | "on_leave" | "terminated"
      employment_type: "permanent" | "contract" | "casual" | "intern"
      gender_type: "male" | "female" | "other"
      leave_status:
        | "draft"
        | "pending_supervisor"
        | "pending_dept_head"
        | "pending_hr"
        | "approved"
        | "rejected"
        | "cancelled"
        | "changes_requested"
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
      app_role: [
        "system_admin",
        "hr_officer",
        "dept_head",
        "supervisor",
        "employee",
      ],
      approval_action: [
        "submit",
        "approve",
        "reject",
        "request_changes",
        "cancel",
        "comment",
      ],
      employee_status: ["active", "inactive", "on_leave", "terminated"],
      employment_type: ["permanent", "contract", "casual", "intern"],
      gender_type: ["male", "female", "other"],
      leave_status: [
        "draft",
        "pending_supervisor",
        "pending_dept_head",
        "pending_hr",
        "approved",
        "rejected",
        "cancelled",
        "changes_requested",
      ],
    },
  },
} as const
