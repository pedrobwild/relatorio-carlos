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
      formalization_acknowledgements: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string
          acknowledged_by_email: string | null
          acknowledged_by_user_id: string | null
          created_at: string
          formalization_id: string
          id: string
          ip_address: string | null
          party_id: string
          signature_hash: string | null
          signature_text: string | null
          user_agent: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string
          acknowledged_by_email?: string | null
          acknowledged_by_user_id?: string | null
          created_at?: string
          formalization_id: string
          id?: string
          ip_address?: string | null
          party_id: string
          signature_hash?: string | null
          signature_text?: string | null
          user_agent?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string
          acknowledged_by_email?: string | null
          acknowledged_by_user_id?: string | null
          created_at?: string
          formalization_id?: string
          id?: string
          ip_address?: string | null
          party_id?: string
          signature_hash?: string | null
          signature_text?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formalization_acknowledgements_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_acknowledgements_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations_public_customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_acknowledgements_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "formalization_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      formalization_attachments: {
        Row: {
          created_at: string
          formalization_id: string
          id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          formalization_id: string
          id?: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          formalization_id?: string
          id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "formalization_attachments_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_attachments_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations_public_customer"
            referencedColumns: ["id"]
          },
        ]
      }
      formalization_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["formalization_event_type"]
          formalization_id: string
          id: string
          meta: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["formalization_event_type"]
          formalization_id: string
          id?: string
          meta?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["formalization_event_type"]
          formalization_id?: string
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formalization_events_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_events_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations_public_customer"
            referencedColumns: ["id"]
          },
        ]
      }
      formalization_evidence_links: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          formalization_id: string
          id: string
          kind: Database["public"]["Enums"]["evidence_link_kind"]
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          formalization_id: string
          id?: string
          kind: Database["public"]["Enums"]["evidence_link_kind"]
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          formalization_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["evidence_link_kind"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "formalization_evidence_links_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_evidence_links_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations_public_customer"
            referencedColumns: ["id"]
          },
        ]
      }
      formalization_parties: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          formalization_id: string
          id: string
          must_sign: boolean
          party_type: Database["public"]["Enums"]["party_type"]
          role_label: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          formalization_id: string
          id?: string
          must_sign?: boolean
          party_type: Database["public"]["Enums"]["party_type"]
          role_label?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          formalization_id?: string
          id?: string
          must_sign?: boolean
          party_type?: Database["public"]["Enums"]["party_type"]
          role_label?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formalization_parties_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_parties_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations_public_customer"
            referencedColumns: ["id"]
          },
        ]
      }
      formalizations: {
        Row: {
          body_md: string
          created_at: string
          created_by: string
          customer_org_id: string
          data: Json
          id: string
          last_activity_at: string
          locked_at: string | null
          locked_hash: string | null
          prev_hash: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["formalization_status"]
          summary: string
          title: string
          type: Database["public"]["Enums"]["formalization_type"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by: string
          customer_org_id: string
          data?: Json
          id?: string
          last_activity_at?: string
          locked_at?: string | null
          locked_hash?: string | null
          prev_hash?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["formalization_status"]
          summary: string
          title: string
          type: Database["public"]["Enums"]["formalization_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string
          customer_org_id?: string
          data?: Json
          id?: string
          last_activity_at?: string
          locked_at?: string | null
          locked_hash?: string | null
          prev_hash?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["formalization_status"]
          summary?: string
          title?: string
          type?: Database["public"]["Enums"]["formalization_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          customer_org_id: string
          display_name: string | null
          email: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_org_id: string
          display_name?: string | null
          email?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_org_id?: string
          display_name?: string | null
          email?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_customers: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          id: string
          invitation_accepted_at: string | null
          invitation_sent_at: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_customers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          mime_type: string | null
          name: string
          project_id: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_engineers: {
        Row: {
          created_at: string
          engineer_user_id: string
          id: string
          is_primary: boolean
          project_id: string
        }
        Insert: {
          created_at?: string
          engineer_user_id: string
          id?: string
          is_primary?: boolean
          project_id: string
        }
        Update: {
          created_at?: string
          engineer_user_id?: string
          id?: string
          is_primary?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_engineers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          payment_proof_path: string | null
          project_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          installment_number: number
          paid_at?: string | null
          payment_proof_path?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          payment_proof_path?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          address: string | null
          contract_value: number | null
          created_at: string
          created_by: string
          id: string
          name: string
          planned_end_date: string
          planned_start_date: string
          status: string
          unit_name: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address?: string | null
          contract_value?: number | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          planned_end_date: string
          planned_start_date: string
          status?: string
          unit_name?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          planned_end_date?: string
          planned_start_date?: string
          status?: string
          unit_name?: string | null
          updated_at?: string
        }
        Relationships: []
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
      formalizations_public_customer: {
        Row: {
          acknowledgements: Json | null
          attachments: Json | null
          body_md: string | null
          created_at: string | null
          customer_org_id: string | null
          data: Json | null
          events: Json | null
          evidence_links: Json | null
          id: string | null
          last_activity_at: string | null
          locked_at: string | null
          locked_hash: string | null
          parties: Json | null
          parties_signed: number | null
          parties_total: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["formalization_status"] | null
          summary: string | null
          title: string | null
          type: Database["public"]["Enums"]["formalization_type"] | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledgements?: never
          attachments?: never
          body_md?: string | null
          created_at?: string | null
          customer_org_id?: string | null
          data?: Json | null
          events?: never
          evidence_links?: never
          id?: string | null
          last_activity_at?: string | null
          locked_at?: string | null
          locked_hash?: string | null
          parties?: never
          parties_signed?: never
          parties_total?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["formalization_status"] | null
          summary?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["formalization_type"] | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledgements?: never
          attachments?: never
          body_md?: string | null
          created_at?: string | null
          customer_org_id?: string | null
          data?: Json | null
          events?: never
          evidence_links?: never
          id?: string | null
          last_activity_at?: string | null
          locked_at?: string | null
          locked_hash?: string | null
          parties?: never
          parties_signed?: never
          parties_total?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["formalization_status"] | null
          summary?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["formalization_type"] | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_formalization_hash: {
        Args: { p_formalization_id: string }
        Returns: string
      }
      get_user_org_id: { Args: { p_user_id: string }; Returns: string }
      get_user_profile: {
        Args: { p_user_id: string }
        Returns: {
          customer_org_id: string
          role: string
        }[]
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_org: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_admin: { Args: { p_user_id: string }; Returns: boolean }
      user_is_staff_or_above: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "engineer" | "admin" | "customer"
      evidence_link_kind:
        | "meeting_recording"
        | "drive_link"
        | "external_doc"
        | "other"
      formalization_event_type:
        | "created"
        | "updated"
        | "sent_for_signature"
        | "signed_by_party"
        | "locked"
        | "voided"
        | "evidence_added"
        | "attachment_added"
      formalization_status: "draft" | "pending_signatures" | "signed" | "voided"
      formalization_type:
        | "budget_item_swap"
        | "meeting_minutes"
        | "exception_custody"
        | "scope_change"
        | "general"
      party_type: "customer" | "company"
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
      app_role: ["engineer", "admin", "customer"],
      evidence_link_kind: [
        "meeting_recording",
        "drive_link",
        "external_doc",
        "other",
      ],
      formalization_event_type: [
        "created",
        "updated",
        "sent_for_signature",
        "signed_by_party",
        "locked",
        "voided",
        "evidence_added",
        "attachment_added",
      ],
      formalization_status: ["draft", "pending_signatures", "signed", "voided"],
      formalization_type: [
        "budget_item_swap",
        "meeting_minutes",
        "exception_custody",
        "scope_change",
        "general",
      ],
      party_type: ["customer", "company"],
    },
  },
} as const
