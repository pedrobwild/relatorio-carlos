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
      domain_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          ip_address: string | null
          org_id: string
          payload: Json
          project_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          ip_address?: string | null
          org_id: string
          payload?: Json
          project_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          payload?: Json
          project_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "domain_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
      formalization_versions: {
        Row: {
          body_md: string
          created_at: string
          created_by: string
          data: Json
          formalization_id: string
          id: string
          summary: string
          title: string
          version_number: number
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by: string
          data?: Json
          formalization_id: string
          id?: string
          summary: string
          title: string
          version_number?: number
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string
          data?: Json
          formalization_id?: string
          id?: string
          summary?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "formalization_versions_formalization_id_fkey"
            columns: ["formalization_id"]
            isOneToOne: false
            referencedRelation: "formalizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formalization_versions_formalization_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "formalizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "formalizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_items: {
        Row: {
          action_url: string | null
          amount: number | null
          created_at: string
          customer_org_id: string
          description: string | null
          due_date: string | null
          id: string
          impact: string | null
          options: Json | null
          project_id: string
          reference_id: string | null
          reference_type: string | null
          resolution_notes: string | null
          resolution_payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["pending_item_status"]
          title: string
          type: Database["public"]["Enums"]["pending_item_type"]
        }
        Insert: {
          action_url?: string | null
          amount?: number | null
          created_at?: string
          customer_org_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          options?: Json | null
          project_id: string
          reference_id?: string | null
          reference_type?: string | null
          resolution_notes?: string | null
          resolution_payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["pending_item_status"]
          title: string
          type: Database["public"]["Enums"]["pending_item_type"]
        }
        Update: {
          action_url?: string | null
          amount?: number | null
          created_at?: string
          customer_org_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          options?: Json | null
          project_id?: string
          reference_id?: string | null
          reference_type?: string | null
          resolution_notes?: string | null
          resolution_payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["pending_item_status"]
          title?: string
          type?: Database["public"]["Enums"]["pending_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pending_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_activities: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          baseline_end: string | null
          baseline_saved_at: string | null
          baseline_start: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          planned_end: string
          planned_start: string
          predecessor_ids: string[] | null
          project_id: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          baseline_end?: string | null
          baseline_saved_at?: string | null
          baseline_start?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          planned_end: string
          planned_start: string
          predecessor_ids?: string[] | null
          project_id: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          baseline_end?: string | null
          baseline_saved_at?: string | null
          baseline_start?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          planned_end?: string
          planned_start?: string
          predecessor_ids?: string[] | null
          project_id?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
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
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          document_type: string
          id: string
          mime_type: string | null
          name: string
          parent_document_id: string | null
          project_id: string
          size_bytes: number | null
          status: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          document_type: string
          id?: string
          mime_type?: string | null
          name: string
          parent_document_id?: string | null
          project_id: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path: string
          uploaded_by: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          document_type?: string
          id?: string
          mime_type?: string | null
          name?: string
          parent_document_id?: string | null
          project_id?: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_engineers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
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
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          planned_end_date?: string
          planned_start_date?: string
          status?: string
          unit_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_errors: {
        Row: {
          created_at: string
          environment: string | null
          error_code: string
          error_message: string
          error_stack: string | null
          function_name: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          project_id: string | null
          request_body: Json | null
          request_headers: Json | null
          request_id: string | null
          request_method: string | null
          request_path: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          environment?: string | null
          error_code: string
          error_message: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          project_id?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          environment?: string | null
          error_code?: string
          error_message?: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          project_id?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
        Relationships: [
          {
            foreignKeyName: "formalizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "formalizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_dashboard_summary: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          contract_value: number | null
          documents_count: number | null
          formalizations_count: number | null
          last_activity_at: string | null
          name: string | null
          org_id: string | null
          overdue_count: number | null
          paid_amount: number | null
          pending_count: number | null
          pending_documents_count: number | null
          pending_signatures_count: number | null
          planned_end_date: string | null
          planned_start_date: string | null
          project_id: string | null
          status: string | null
          total_payments: number | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          contract_value?: number | null
          documents_count?: never
          formalizations_count?: never
          last_activity_at?: never
          name?: string | null
          org_id?: string | null
          overdue_count?: never
          paid_amount?: never
          pending_count?: never
          pending_documents_count?: never
          pending_signatures_count?: never
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id?: string | null
          status?: string | null
          total_payments?: never
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          contract_value?: number | null
          documents_count?: never
          formalizations_count?: never
          last_activity_at?: never
          name?: string | null
          org_id?: string | null
          overdue_count?: never
          paid_amount?: never
          pending_count?: never
          pending_documents_count?: never
          pending_signatures_count?: never
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id?: string | null
          status?: string | null
          total_payments?: never
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_error_stats: {
        Row: {
          affected_requests: number | null
          affected_users: number | null
          error_code: string | null
          error_count: number | null
          hour: string | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      check_error_rate_alerts: {
        Args: { p_lookback_hours?: number; p_threshold_per_hour?: number }
        Returns: {
          error_code: string
          error_count: number
          first_occurrence: string
          last_occurrence: string
          sample_message: string
          source: string
        }[]
      }
      compute_formalization_hash: {
        Args: { p_formalization_id: string }
        Returns: string
      }
      get_formalization_complete: {
        Args: { p_formalization_id: string }
        Returns: {
          acknowledgements: Json
          attachments: Json
          body_md: string
          created_at: string
          created_by: string
          creator_name: string
          customer_org_id: string
          data: Json
          evidence_links: Json
          id: string
          locked_at: string
          locked_hash: string
          parties: Json
          project_id: string
          project_name: string
          recent_events: Json
          signed_parties: number
          status: string
          summary: string
          title: string
          total_parties: number
          type: string
          unit_id: string
          updated_at: string
        }[]
      }
      get_pending_items_with_context: {
        Args: { p_include_completed?: boolean; p_project_id?: string }
        Returns: {
          action_url: string
          amount: number
          created_at: string
          customer_org_id: string
          days_overdue: number
          description: string
          due_date: string
          id: string
          impact: string
          options: Json
          project_id: string
          project_name: string
          reference_id: string
          reference_status: string
          reference_title: string
          reference_type: string
          resolution_notes: string
          resolved_at: string
          resolved_by: string
          resolver_name: string
          status: string
          title: string
          type: string
          urgency_level: string
        }[]
      }
      get_project_activity_timeline: {
        Args: { p_limit?: number; p_offset?: number; p_project_id: string }
        Returns: {
          actor_email: string
          actor_name: string
          actor_user_id: string
          created_at: string
          entity_id: string
          entity_title: string
          entity_type: string
          event_type: string
          id: string
          ip_address: string
          payload: Json
        }[]
      }
      get_user_org_id: { Args: { p_user_id: string }; Returns: string }
      get_user_profile: {
        Args: { p_user_id: string }
        Returns: {
          customer_org_id: string
          role: string
        }[]
      }
      get_user_projects_summary: {
        Args: never
        Returns: {
          actual_end_date: string
          actual_start_date: string
          contract_value: number
          id: string
          last_activity_at: string
          name: string
          org_id: string
          org_name: string
          overdue_count: number
          pending_count: number
          pending_documents: number
          planned_end_date: string
          planned_start_date: string
          progress_percentage: number
          status: string
          unsigned_formalizations: number
          user_role: string
        }[]
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _role: Database["public"]["Enums"]["project_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_domain_event: {
        Args: {
          _entity_id: string
          _entity_type: string
          _event_type: string
          _ip_address?: string
          _org_id: string
          _payload?: Json
          _project_id: string
          _user_agent?: string
        }
        Returns: string
      }
      log_system_error: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_error_stack?: string
          p_function_name?: string
          p_metadata?: Json
          p_org_id?: string
          p_project_id?: string
          p_request_id?: string
          p_request_method?: string
          p_request_path?: string
          p_source: string
          p_user_id?: string
        }
        Returns: string
      }
      user_belongs_to_org: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      user_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_admin: { Args: { p_user_id: string }; Returns: boolean }
      user_is_staff_or_above: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "engineer" | "admin" | "customer" | "manager"
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
      pending_item_status: "pending" | "completed" | "cancelled"
      pending_item_type:
        | "approve_3d"
        | "approve_executive"
        | "signature"
        | "decision"
        | "invoice"
        | "extra_purchase"
      project_role: "owner" | "engineer" | "viewer" | "customer"
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
      app_role: ["engineer", "admin", "customer", "manager"],
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
      pending_item_status: ["pending", "completed", "cancelled"],
      pending_item_type: [
        "approve_3d",
        "approve_executive",
        "signature",
        "decision",
        "invoice",
        "extra_purchase",
      ],
      project_role: ["owner", "engineer", "viewer", "customer"],
    },
  },
} as const
