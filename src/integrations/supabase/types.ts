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
      anexos: {
        Row: {
          created_at: string
          entidade_id: string
          entidade_tipo: Database["public"]["Enums"]["entidade_tipo"]
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          obra_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entidade_id: string
          entidade_tipo: Database["public"]["Enums"]["entidade_tipo"]
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          obra_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entidade_id?: string
          entidade_tipo?: Database["public"]["Enums"]["entidade_tipo"]
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          obra_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_logs: {
        Row: {
          answer_summary: string | null
          conversation_id: string | null
          created_at: string
          domain: string | null
          error_message: string | null
          generated_sql: string | null
          id: string
          latency_ms: number | null
          model: string | null
          question: string
          rows_returned: number | null
          status: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          answer_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          domain?: string | null
          error_message?: string | null
          generated_sql?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          question: string
          rows_returned?: number | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          answer_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          domain?: string | null
          error_message?: string | null
          generated_sql?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          question?: string
          rows_returned?: number | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          log_id: string | null
          result_data: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          log_id?: string | null
          result_data?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          log_id?: string | null
          result_data?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string
          data_prevista_fim: string | null
          data_prevista_inicio: string | null
          data_real_fim: string | null
          data_real_inicio: string | null
          dependencias: string[] | null
          descricao: string | null
          etapa: string | null
          id: string
          obra_id: string
          prioridade: Database["public"]["Enums"]["atividade_prioridade"]
          responsavel_user_id: string | null
          status: Database["public"]["Enums"]["atividade_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_prevista_fim?: string | null
          data_prevista_inicio?: string | null
          data_real_fim?: string | null
          data_real_inicio?: string | null
          dependencias?: string[] | null
          descricao?: string | null
          etapa?: string | null
          id?: string
          obra_id: string
          prioridade?: Database["public"]["Enums"]["atividade_prioridade"]
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["atividade_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_prevista_fim?: string | null
          data_prevista_inicio?: string | null
          data_real_fim?: string | null
          data_real_inicio?: string | null
          dependencias?: string[] | null
          descricao?: string | null
          etapa?: string | null
          id?: string
          obra_id?: string
          prioridade?: Database["public"]["Enums"]["atividade_prioridade"]
          responsavel_user_id?: string | null
          status?: Database["public"]["Enums"]["atividade_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: Database["public"]["Enums"]["auditoria_acao"]
          created_at: string
          diff: Json | null
          entidade: string
          entidade_id: string
          id: string
          obra_id: string | null
          por_user_id: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["auditoria_acao"]
          created_at?: string
          diff?: Json | null
          entidade: string
          entidade_id: string
          id?: string
          obra_id?: string | null
          por_user_id?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["auditoria_acao"]
          created_at?: string
          diff?: Json | null
          entidade?: string
          entidade_id?: string
          id?: string
          obra_id?: string | null
          por_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_por_user_id_fkey"
            columns: ["por_user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios_colaborador: {
        Row: {
          ativo: boolean | null
          colaborador_id: string
          created_at: string | null
          descricao: string | null
          id: string
          tipo: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean | null
          colaborador_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean | null
          colaborador_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          agencia: string | null
          banco: string | null
          carga_horaria: string | null
          cargo: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          data_desligamento: string | null
          data_inicio: string | null
          data_nascimento: string | null
          departamento: string | null
          email_corporativo: string | null
          email_pessoal: string | null
          endereco: string | null
          estado: string | null
          id: string
          motivo_desligamento: string | null
          nome: string
          observacoes: string | null
          salario_base: number | null
          status: string
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          updated_at: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          carga_horaria?: string | null
          cargo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email_corporativo?: string | null
          email_pessoal?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          motivo_desligamento?: string | null
          nome: string
          observacoes?: string | null
          salario_base?: number | null
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          carga_horaria?: string | null
          cargo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email_corporativo?: string | null
          email_pessoal?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          motivo_desligamento?: string | null
          nome?: string
          observacoes?: string | null
          salario_base?: number | null
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      corrective_action_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          template_text: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_text: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_text?: string
          title?: string
        }
        Relationships: []
      }
      cronogramas: {
        Row: {
          created_at: string
          data_fim_prevista: string
          data_inicio: string
          id: string
          obra_id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim_prevista: string
          data_inicio: string
          id?: string
          obra_id: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim_prevista?: string
          data_inicio?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronogramas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_ticket_actions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          responsible_user_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["cs_action_status"]
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          responsible_user_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cs_action_status"]
          ticket_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          responsible_user_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cs_action_status"]
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_ticket_actions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "cs_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_ticket_history: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "cs_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_tickets: {
        Row: {
          action_plan: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          project_id: string
          resolved_at: string | null
          responsible_user_id: string | null
          severity: Database["public"]["Enums"]["cs_ticket_severity"]
          situation: string
          status: Database["public"]["Enums"]["cs_ticket_status"]
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          project_id: string
          resolved_at?: string | null
          responsible_user_id?: string | null
          severity?: Database["public"]["Enums"]["cs_ticket_severity"]
          situation: string
          status?: Database["public"]["Enums"]["cs_ticket_status"]
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          project_id?: string
          resolved_at?: string | null
          responsible_user_id?: string | null
          severity?: Database["public"]["Enums"]["cs_ticket_severity"]
          situation?: string
          status?: Database["public"]["Enums"]["cs_ticket_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cs_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_colaborador: {
        Row: {
          colaborador_id: string
          created_at: string | null
          data_documento: string | null
          descricao: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          data_documento?: string | null
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo: string
          uploaded_by?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          data_documento?: string | null
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          archived_at: string | null
          bucket: string
          category: string | null
          checksum: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          mime_type: string
          org_id: string | null
          original_name: string
          owner_id: string
          project_id: string | null
          retention_days: number | null
          size_bytes: number
          status: Database["public"]["Enums"]["file_status"]
          storage_path: string
          tags: Json | null
          updated_at: string
          visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Insert: {
          archived_at?: string | null
          bucket: string
          category?: string | null
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          mime_type: string
          org_id?: string | null
          original_name: string
          owner_id: string
          project_id?: string | null
          retention_days?: number | null
          size_bytes: number
          status?: Database["public"]["Enums"]["file_status"]
          storage_path: string
          tags?: Json | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["file_visibility"]
        }
        Update: {
          archived_at?: string | null
          bucket?: string
          category?: string | null
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          mime_type?: string
          org_id?: string | null
          original_name?: string
          owner_id?: string
          project_id?: string | null
          retention_days?: number | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["file_status"]
          storage_path?: string
          tags?: Json | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["file_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
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
      fornecedor_anexos: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          fornecedor_id: string
          id: string
          mime_type: string | null
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          fornecedor_id: string
          id?: string
          mime_type?: string | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          fornecedor_id?: string
          id?: string
          mime_type?: string | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_anexos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor_precos: {
        Row: {
          created_at: string | null
          data_validade: string | null
          descricao: string
          fornecedor_id: string
          id: string
          observacoes: string | null
          preco_unitario: number
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_validade?: string | null
          descricao: string
          fornecedor_id: string
          id?: string
          observacoes?: string | null
          preco_unitario: number
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_validade?: string | null
          descricao?: string
          fornecedor_id?: string
          id?: string
          observacoes?: string | null
          preco_unitario?: number
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_precos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          categoria: Database["public"]["Enums"]["supplier_category"]
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          condicoes_pagamento: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          external_id: string | null
          external_system: string | null
          id: string
          nome: string
          nota_avaliacao: number | null
          observacoes: string | null
          prazo_entrega_dias: number | null
          produtos_servicos: string | null
          razao_social: string | null
          site: string | null
          status: string
          supplier_subcategory: string | null
          supplier_type: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["supplier_category"]
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          nome: string
          nota_avaliacao?: number | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          produtos_servicos?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          supplier_subcategory?: string | null
          supplier_type?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["supplier_category"]
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          nome?: string
          nota_avaliacao?: number | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          produtos_servicos?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          supplier_subcategory?: string | null
          supplier_type?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      historico_cargos: {
        Row: {
          aprovado_por: string | null
          cargo_anterior: string | null
          cargo_novo: string
          colaborador_id: string
          created_at: string | null
          data_mudanca: string
          id: string
          motivo: string | null
          salario_anterior: number | null
          salario_novo: number | null
        }
        Insert: {
          aprovado_por?: string | null
          cargo_anterior?: string | null
          cargo_novo: string
          colaborador_id: string
          created_at?: string | null
          data_mudanca: string
          id?: string
          motivo?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Update: {
          aprovado_por?: string | null
          cargo_anterior?: string | null
          cargo_novo?: string
          colaborador_id?: string
          created_at?: string | null
          data_mudanca?: string
          id?: string
          motivo?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_cargos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inspection_id: string
          notes: string | null
          photo_paths: string[] | null
          result: Database["public"]["Enums"]["inspection_item_result"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inspection_id: string
          notes?: string | null
          photo_paths?: string[] | null
          result?: Database["public"]["Enums"]["inspection_item_result"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inspection_id?: string
          notes?: string | null
          photo_paths?: string[] | null
          result?: Database["public"]["Enums"]["inspection_item_result"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      inspections: {
        Row: {
          activity_id: string | null
          client_name: string | null
          client_present: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          inspection_date: string
          inspection_type: string
          inspector_id: string
          inspector_user_id: string | null
          notes: string | null
          project_id: string
          status: Database["public"]["Enums"]["inspection_status"]
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          client_name?: string | null
          client_present?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_id: string
          inspector_user_id?: string | null
          notes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          client_name?: string | null
          client_present?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspection_type?: string
          inspector_id?: string
          inspector_user_id?: string | null
          notes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          ai_diagnosis: string | null
          attempts: number | null
          corrected_payload: Json | null
          created_at: string | null
          entity_type: string
          error_message: string | null
          id: string
          payload: Json | null
          source_id: string
          source_system: string
          sync_status: string
          synced_at: string | null
          target_id: string | null
          target_system: string
        }
        Insert: {
          ai_diagnosis?: string | null
          attempts?: number | null
          corrected_payload?: Json | null
          created_at?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_id: string
          source_system: string
          sync_status?: string
          synced_at?: string | null
          target_id?: string | null
          target_system: string
        }
        Update: {
          ai_diagnosis?: string | null
          attempts?: number | null
          corrected_payload?: Json | null
          created_at?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          source_id?: string
          source_system?: string
          sync_status?: string
          synced_at?: string | null
          target_id?: string | null
          target_system?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          metadata: Json | null
          project_id: string | null
          project_role: Database["public"]["Enums"]["project_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          metadata?: Json | null
          project_id?: string | null
          project_role?: Database["public"]["Enums"]["project_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          metadata?: Json | null
          project_id?: string | null
          project_role?: Database["public"]["Enums"]["project_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_csm: {
        Row: {
          created_at: string
          description: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          project_id: string
          role_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          project_id: string
          role_title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          project_id?: string
          role_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_csm_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_csm_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_footer: {
        Row: {
          created_at: string
          id: string
          project_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          text?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_footer_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_footer_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_hero: {
        Row: {
          badge_text: string | null
          created_at: string
          id: string
          project_id: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          created_at?: string
          id?: string
          project_id: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          created_at?: string
          id?: string
          project_id?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_hero_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_hero_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_meeting_availability: {
        Row: {
          confirmed_by: string | null
          confirmed_datetime: string | null
          created_at: string
          end_date: string
          id: string
          meeting_details_text: string | null
          notes: string | null
          preferred_weekdays: string[]
          project_id: string
          stage_id: string
          start_date: string
          status: string
          submitted_at: string
          submitted_by: string
          time_slots: string[]
          updated_at: string
        }
        Insert: {
          confirmed_by?: string | null
          confirmed_datetime?: string | null
          created_at?: string
          end_date: string
          id?: string
          meeting_details_text?: string | null
          notes?: string | null
          preferred_weekdays?: string[]
          project_id: string
          stage_id: string
          start_date: string
          status?: string
          submitted_at?: string
          submitted_by: string
          time_slots?: string[]
          updated_at?: string
        }
        Update: {
          confirmed_by?: string | null
          confirmed_datetime?: string | null
          created_at?: string
          end_date?: string
          id?: string
          meeting_details_text?: string | null
          notes?: string | null
          preferred_weekdays?: string[]
          project_id?: string
          stage_id?: string
          start_date?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          time_slots?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_meeting_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_meeting_availability_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_meeting_availability_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_meeting_slots: {
        Row: {
          booked_at: string | null
          booked_by: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          is_booked: boolean | null
          slot_datetime: string
          stage_id: string
        }
        Insert: {
          booked_at?: string | null
          booked_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_booked?: boolean | null
          slot_datetime: string
          stage_id: string
        }
        Update: {
          booked_at?: string | null
          booked_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          is_booked?: boolean | null
          slot_datetime?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_meeting_slots_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stage_date_log: {
        Row: {
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          stage_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          stage_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stage_date_log_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stage_messages: {
        Row: {
          author_id: string
          author_name: string
          author_role: string
          created_at: string
          id: string
          message: string
          project_id: string
          stage_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_role?: string
          created_at?: string
          id?: string
          message: string
          project_id: string
          stage_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_role?: string
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stage_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_stage_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_stage_messages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stage_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          project_id: string
          sort_order: number
          stage_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
          stage_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number
          stage_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stage_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_stage_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_stage_photos_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stage_records: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          evidence_url: string | null
          id: string
          project_id: string
          record_date: string
          responsible: string
          stage_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          project_id: string
          record_date?: string
          responsible?: string
          stage_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          project_id?: string
          record_date?: string
          responsible?: string
          stage_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stage_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_stage_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_stage_records_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stages: {
        Row: {
          confirmed_end: string | null
          confirmed_start: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          cta_visible: boolean
          dependencies_text: string | null
          description: string | null
          icon: string | null
          id: string
          microcopy: string | null
          name: string
          project_id: string
          proposed_end: string | null
          proposed_start: string | null
          responsible: string | null
          revision_text: string | null
          sort_order: number
          status: Database["public"]["Enums"]["journey_stage_status"]
          updated_at: string
          waiting_since: string | null
          warning_text: string | null
        }
        Insert: {
          confirmed_end?: string | null
          confirmed_start?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          cta_visible?: boolean
          dependencies_text?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          microcopy?: string | null
          name: string
          project_id: string
          proposed_end?: string | null
          proposed_start?: string | null
          responsible?: string | null
          revision_text?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["journey_stage_status"]
          updated_at?: string
          waiting_since?: string | null
          warning_text?: string | null
        }
        Update: {
          confirmed_end?: string | null
          confirmed_start?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          cta_visible?: boolean
          dependencies_text?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          microcopy?: string | null
          name?: string
          project_id?: string
          proposed_end?: string | null
          proposed_start?: string | null
          responsible?: string | null
          revision_text?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["journey_stage_status"]
          updated_at?: string
          waiting_since?: string | null
          warning_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_team_members: {
        Row: {
          created_at: string
          description: string
          display_name: string
          email: string | null
          id: string
          phone: string | null
          photo_url: string | null
          project_id: string
          role_title: string
          sort_order: number
          stage_context: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_name: string
          email?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          project_id: string
          role_title?: string
          sort_order?: number
          stage_context?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_name?: string
          email?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          project_id?: string
          role_title?: string
          sort_order?: number
          stage_context?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journey_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_todos: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          owner: string
          sort_order: number
          stage_id: string
          text: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          owner: string
          sort_order?: number
          stage_id: string
          text: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          owner?: string
          sort_order?: number
          stage_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_todos_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      marcos: {
        Row: {
          created_at: string
          cronograma_id: string
          data_prevista: string
          data_real: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["marco_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cronograma_id: string
          data_prevista: string
          data_real?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["marco_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cronograma_id?: string
          data_prevista?: string
          data_real?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["marco_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marcos_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_history: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          nc_id: string
          new_status: Database["public"]["Enums"]["nc_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["nc_status"] | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          nc_id: string
          new_status?: Database["public"]["Enums"]["nc_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["nc_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          nc_id?: string
          new_status?: Database["public"]["Enums"]["nc_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["nc_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_history_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformities"
            referencedColumns: ["id"]
          },
        ]
      }
      non_conformities: {
        Row: {
          actual_cost: number | null
          approved_at: string | null
          approved_by: string | null
          category: string | null
          corrective_action: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          estimated_cost: number | null
          evidence_photo_paths: string[] | null
          evidence_photos_after: string[] | null
          evidence_photos_before: string[] | null
          id: string
          inspection_id: string | null
          inspection_item_id: string | null
          project_id: string
          rejection_reason: string | null
          reopen_count: number
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          responsible_user_id: string | null
          root_cause: string | null
          severity: Database["public"]["Enums"]["nc_severity"]
          status: Database["public"]["Enums"]["nc_status"]
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          actual_cost?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          estimated_cost?: number | null
          evidence_photo_paths?: string[] | null
          evidence_photos_after?: string[] | null
          evidence_photos_before?: string[] | null
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          project_id: string
          rejection_reason?: string | null
          reopen_count?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_user_id?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["nc_severity"]
          status?: Database["public"]["Enums"]["nc_status"]
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          actual_cost?: number | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          estimated_cost?: number | null
          evidence_photo_paths?: string[] | null
          evidence_photos_after?: string[] | null
          evidence_photos_before?: string[] | null
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          project_id?: string
          rejection_reason?: string | null
          reopen_count?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_user_id?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["nc_severity"]
          status?: Database["public"]["Enums"]["nc_status"]
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformities_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "non_conformities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          project_id: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "obra_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_task_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["obra_task_status"]
          old_status: Database["public"]["Enums"]["obra_task_status"] | null
          task_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["obra_task_status"]
          old_status?: Database["public"]["Enums"]["obra_task_status"] | null
          task_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["obra_task_status"]
          old_status?: Database["public"]["Enums"]["obra_task_status"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "obra_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_task_subtasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          sort_order: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "obra_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_tasks: {
        Row: {
          completed_at: string | null
          cost: number | null
          created_at: string
          created_by: string
          days_overdue: number | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          project_id: string
          responsible_user_id: string | null
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["obra_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          days_overdue?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id: string
          responsible_user_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["obra_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          days_overdue?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string
          responsible_user_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["obra_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "obra_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          codigo_interno: string | null
          created_at: string
          id: string
          nome_da_obra: string
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
        }
        Insert: {
          codigo_interno?: string | null
          created_at?: string
          id?: string
          nome_da_obra: string
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Update: {
          codigo_interno?: string | null
          created_at?: string
          id?: string
          nome_da_obra?: string
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Relationships: []
      }
      obras_studio_info: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          data_de_recebimento_das_chaves: string | null
          endereco_completo_do_studio: string | null
          nome_do_empreendimento: string | null
          obra_id: string
          tamanho_do_imovel_m2: number | null
          tipo_de_locacao: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_de_recebimento_das_chaves?: string | null
          endereco_completo_do_studio?: string | null
          nome_do_empreendimento?: string | null
          obra_id: string
          tamanho_do_imovel_m2?: number | null
          tipo_de_locacao?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_de_recebimento_das_chaves?: string | null
          endereco_completo_do_studio?: string | null
          nome_do_empreendimento?: string | null
          obra_id?: string
          tamanho_do_imovel_m2?: number | null
          tipo_de_locacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_studio_info_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: true
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_adjustments: {
        Row: {
          amount: number
          created_at: string
          external_id: string | null
          id: string
          label: string
          orcamento_id: string
          order_index: number
          sign: number
        }
        Insert: {
          amount?: number
          created_at?: string
          external_id?: string | null
          id?: string
          label: string
          orcamento_id: string
          order_index?: number
          sign?: number
        }
        Update: {
          amount?: number
          created_at?: string
          external_id?: string | null
          id?: string
          label?: string
          orcamento_id?: string
          order_index?: number
          sign?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_adjustments_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_eventos: {
        Row: {
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          note: string | null
          orcamento_id: string
          to_status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          note?: string | null
          orcamento_id: string
          to_status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          note?: string | null
          orcamento_id?: string
          to_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_eventos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_items: {
        Row: {
          bdi_percentage: number | null
          catalog_item_id: string | null
          coverage_type: string | null
          created_at: string
          description: string | null
          excluded_rooms: string[] | null
          id: string
          included_rooms: string[] | null
          internal_total: number | null
          internal_unit_price: number | null
          item_category: string | null
          notes: string | null
          order_index: number
          qty: number | null
          reference_url: string | null
          section_id: string
          supplier_id: string | null
          supplier_name: string | null
          title: string
          unit: string | null
        }
        Insert: {
          bdi_percentage?: number | null
          catalog_item_id?: string | null
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          excluded_rooms?: string[] | null
          id?: string
          included_rooms?: string[] | null
          internal_total?: number | null
          internal_unit_price?: number | null
          item_category?: string | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
          section_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          title: string
          unit?: string | null
        }
        Update: {
          bdi_percentage?: number | null
          catalog_item_id?: string | null
          coverage_type?: string | null
          created_at?: string
          description?: string | null
          excluded_rooms?: string[] | null
          id?: string
          included_rooms?: string[] | null
          internal_total?: number | null
          internal_unit_price?: number | null
          item_category?: string | null
          notes?: string | null
          order_index?: number
          qty?: number | null
          reference_url?: string | null
          section_id?: string
          supplier_id?: string | null
          supplier_name?: string | null
          title?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "orcamento_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_notas: {
        Row: {
          body: string
          created_at: string
          id: string
          orcamento_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          orcamento_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          orcamento_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_notas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_notas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_sections: {
        Row: {
          bdi_percentage: number | null
          cost: number | null
          cover_image_url: string | null
          created_at: string
          excluded_bullets: string[] | null
          id: string
          included_bullets: string[] | null
          is_optional: boolean
          item_count: number | null
          notes: string | null
          orcamento_id: string
          order_index: number
          section_price: number | null
          subtitle: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          bdi_percentage?: number | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          excluded_bullets?: string[] | null
          id?: string
          included_bullets?: string[] | null
          is_optional?: boolean
          item_count?: number | null
          notes?: string | null
          orcamento_id: string
          order_index?: number
          section_price?: number | null
          subtitle?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          bdi_percentage?: number | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          excluded_bullets?: string[] | null
          id?: string
          included_bullets?: string[] | null
          is_optional?: boolean
          item_count?: number | null
          notes?: string | null
          orcamento_id?: string
          order_index?: number
          section_price?: number | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_sections_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          avg_bdi: number | null
          bairro: string | null
          briefing: string | null
          city: string | null
          client_name: string
          commercial_owner_id: string | null
          condominio: string | null
          created_at: string
          created_by: string | null
          demand_context: string | null
          due_at: string | null
          estimator_owner_id: string | null
          external_id: string | null
          external_system: string | null
          id: string
          internal_notes: string | null
          internal_status: Database["public"]["Enums"]["orcamento_status"]
          metragem: string | null
          net_margin: number | null
          priority: Database["public"]["Enums"]["orcamento_priority"]
          project_id: string | null
          project_name: string
          property_type: string | null
          reference_links: string[] | null
          sequential_code: string | null
          total_cost: number | null
          total_sale: number | null
          total_value: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          avg_bdi?: number | null
          bairro?: string | null
          briefing?: string | null
          city?: string | null
          client_name: string
          commercial_owner_id?: string | null
          condominio?: string | null
          created_at?: string
          created_by?: string | null
          demand_context?: string | null
          due_at?: string | null
          estimator_owner_id?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          internal_notes?: string | null
          internal_status?: Database["public"]["Enums"]["orcamento_status"]
          metragem?: string | null
          net_margin?: number | null
          priority?: Database["public"]["Enums"]["orcamento_priority"]
          project_id?: string | null
          project_name: string
          property_type?: string | null
          reference_links?: string[] | null
          sequential_code?: string | null
          total_cost?: number | null
          total_sale?: number | null
          total_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          avg_bdi?: number | null
          bairro?: string | null
          briefing?: string | null
          city?: string | null
          client_name?: string
          commercial_owner_id?: string | null
          condominio?: string | null
          created_at?: string
          created_by?: string | null
          demand_context?: string | null
          due_at?: string | null
          estimator_owner_id?: string | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          internal_notes?: string | null
          internal_status?: Database["public"]["Enums"]["orcamento_status"]
          metragem?: string | null
          net_margin?: number | null
          priority?: Database["public"]["Enums"]["orcamento_priority"]
          project_id?: string | null
          project_name?: string
          property_type?: string | null
          reference_links?: string[] | null
          sequential_code?: string | null
          total_cost?: number | null
          total_sale?: number | null
          total_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_commercial_owner_id_fkey"
            columns: ["commercial_owner_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_estimator_owner_id_fkey"
            columns: ["estimator_owner_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "orcamentos_project_id_fkey"
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
      politicas_comissao: {
        Row: {
          ativo: boolean | null
          base_calculo: string | null
          colaborador_id: string
          created_at: string | null
          descricao: string
          id: string
          meta_mensal: number | null
          observacoes: string | null
          percentual: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_calculo?: string | null
          colaborador_id: string
          created_at?: string | null
          descricao: string
          id?: string
          meta_mensal?: number | null
          observacoes?: string | null
          percentual?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_calculo?: string | null
          colaborador_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          meta_mensal?: number | null
          observacoes?: string | null
          percentual?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "politicas_comissao_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      politicas_veiculo: {
        Row: {
          ativo: boolean | null
          colaborador_id: string
          created_at: string | null
          id: string
          modelo_veiculo: string | null
          observacoes: string | null
          placa_veiculo: string | null
          tem_direito: boolean | null
          teto_mensal: number | null
          tipo: string | null
          valor_km: number | null
        }
        Insert: {
          ativo?: boolean | null
          colaborador_id: string
          created_at?: string | null
          id?: string
          modelo_veiculo?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          tem_direito?: boolean | null
          teto_mensal?: number | null
          tipo?: string | null
          valor_km?: number | null
        }
        Update: {
          ativo?: boolean | null
          colaborador_id?: string
          created_at?: string | null
          id?: string
          modelo_veiculo?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          tem_direito?: boolean | null
          teto_mensal?: number | null
          tipo?: string | null
          valor_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "politicas_veiculo_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
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
      project_3d_comments: {
        Row: {
          author_user_id: string
          created_at: string
          id: string
          image_id: string
          text: string
          updated_at: string
          x_percent: number
          y_percent: number
        }
        Insert: {
          author_user_id: string
          created_at?: string
          id?: string
          image_id: string
          text: string
          updated_at?: string
          x_percent: number
          y_percent: number
        }
        Update: {
          author_user_id?: string
          created_at?: string
          id?: string
          image_id?: string
          text?: string
          updated_at?: string
          x_percent?: number
          y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_3d_comments_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "project_3d_images"
            referencedColumns: ["id"]
          },
        ]
      }
      project_3d_images: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_3d_images_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "project_3d_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_3d_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          project_id: string
          sort_order: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_3d_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_3d_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_3d_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          revision_requested_at: string | null
          revision_requested_by: string | null
          stage_key: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          stage_key?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          stage_key?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_3d_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_3d_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          detailed_description: string | null
          etapa: string | null
          fornecedor_id: string | null
          id: string
          parent_activity_id: string | null
          planned_end: string
          planned_start: string
          predecessor_ids: string[] | null
          project_id: string
          responsible_user_id: string | null
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
          detailed_description?: string | null
          etapa?: string | null
          fornecedor_id?: string | null
          id?: string
          parent_activity_id?: string | null
          planned_end: string
          planned_start: string
          predecessor_ids?: string[] | null
          project_id: string
          responsible_user_id?: string | null
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
          detailed_description?: string | null
          etapa?: string | null
          fornecedor_id?: string | null
          id?: string
          parent_activity_id?: string | null
          planned_end?: string
          planned_start?: string
          predecessor_ids?: string[] | null
          project_id?: string
          responsible_user_id?: string | null
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_parent_activity_id_fkey"
            columns: ["parent_activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "project_activities_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      project_customers: {
        Row: {
          cidade: string | null
          cpf: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          endereco_residencial: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          invitation_accepted_at: string | null
          invitation_sent_at: string | null
          nacionalidade: string | null
          profissao: string | null
          project_id: string
          rg: string | null
        }
        Insert: {
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          endereco_residencial?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          nacionalidade?: string | null
          profissao?: string | null
          project_id: string
          rg?: string | null
        }
        Update: {
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          endereco_residencial?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          nacionalidade?: string | null
          profissao?: string | null
          project_id?: string
          rg?: string | null
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
      project_daily_log_service_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          position: number
          responsible_user_id: string | null
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          position?: number
          responsible_user_id?: string | null
          service_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          position?: number
          responsible_user_id?: string | null
          service_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_log_service_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_log_service_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_log_service_tasks_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_log_service_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "project_daily_log_services"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_log_services: {
        Row: {
          created_at: string
          daily_log_id: string
          description: string
          end_date: string | null
          id: string
          observations: string | null
          position: number
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          description: string
          end_date?: string | null
          id?: string
          observations?: string | null
          position?: number
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          description?: string
          end_date?: string | null
          id?: string
          observations?: string | null
          position?: number
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_log_services_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "project_daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_log_workers: {
        Row: {
          created_at: string
          daily_log_id: string
          id: string
          name: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          position: number
          role: string | null
          shift_end: string | null
          shift_start: string | null
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          id?: string
          name: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          position?: number
          role?: string | null
          shift_end?: string | null
          shift_start?: string | null
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          id?: string
          name?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          position?: number
          role?: string | null
          shift_end?: string | null
          shift_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_log_workers_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "project_daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          log_date: string
          notes: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_document_comments: {
        Row: {
          comment: string
          created_at: string
          document_id: string
          id: string
          page_number: number | null
          project_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          comment: string
          created_at?: string
          document_id: string
          id?: string
          page_number?: number | null
          project_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          comment?: string
          created_at?: string
          document_id?: string
          id?: string
          page_number?: number | null
          project_id?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_document_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_document_review_comments: {
        Row: {
          author_id: string
          author_role: string | null
          created_at: string
          document_id: string
          id: string
          message: string
          page_number: number
          parent_id: string | null
          project_id: string
          rect_h: number | null
          rect_w: number | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          status: Database["public"]["Enums"]["review_comment_status"]
          tags: string[]
          x: number
          y: number
        }
        Insert: {
          author_id: string
          author_role?: string | null
          created_at?: string
          document_id: string
          id?: string
          message: string
          page_number: number
          parent_id?: string | null
          project_id: string
          rect_h?: number | null
          rect_w?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          status?: Database["public"]["Enums"]["review_comment_status"]
          tags?: string[]
          x: number
          y: number
        }
        Update: {
          author_id?: string
          author_role?: string | null
          created_at?: string
          document_id?: string
          id?: string
          message?: string
          page_number?: number
          parent_id?: string | null
          project_id?: string
          rect_h?: number | null
          rect_w?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: Database["public"]["Enums"]["review_comment_status"]
          tags?: string[]
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_document_review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_document_review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_review_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_document_review_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "project_document_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      project_document_reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          document_id: string
          file_path: string | null
          id: string
          project_id: string
          revision_number: number
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          document_id: string
          file_path?: string | null
          id?: string
          project_id: string
          revision_number?: number
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          file_path?: string | null
          id?: string
          project_id?: string
          revision_number?: number
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_document_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_document_reviews_project_id_fkey"
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
          checksum: string | null
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
          checksum?: string | null
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
          checksum?: string | null
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
      project_info_docs: {
        Row: {
          content_html: string
          created_at: string
          id: string
          last_edited_by: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_info_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_info_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_member_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by: string | null
          id: string
          permission: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_member_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_member_permissions_project_id_fkey"
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
      project_non_working_days: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          id: string
          project_id: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          id?: string
          project_id?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          id?: string
          project_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_non_working_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_non_working_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_page_instructions: {
        Row: {
          content_html: string
          created_at: string
          id: string
          page_key: string
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          page_key: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          page_key?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      project_payments: {
        Row: {
          amount: number
          boleto_code: string | null
          boleto_path: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          installment_number: number
          notification_sent_at: string | null
          paid_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          pix_key: string | null
          project_id: string
        }
        Insert: {
          amount: number
          boleto_code?: string | null
          boleto_path?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          installment_number: number
          notification_sent_at?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          pix_key?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          boleto_code?: string | null
          boleto_path?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          notification_sent_at?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          pix_key?: string | null
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
      project_planned_dates_resync_runs: {
        Row: {
          changed_ids: string[]
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          out_of_sync_ids_before: string[]
          projects_changed: number
          projects_out_of_sync_before: number
          projects_total: number
          started_at: string
          still_out_of_sync_ids_after: string[]
        }
        Insert: {
          changed_ids?: string[]
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          out_of_sync_ids_before?: string[]
          projects_changed?: number
          projects_out_of_sync_before?: number
          projects_total?: number
          started_at?: string
          still_out_of_sync_ids_after?: string[]
        }
        Update: {
          changed_ids?: string[]
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          out_of_sync_ids_before?: string[]
          projects_changed?: number
          projects_out_of_sync_before?: number
          projects_total?: number
          started_at?: string
          still_out_of_sync_ids_after?: string[]
        }
        Relationships: []
      }
      project_purchase_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          purchase_id: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          purchase_id: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          purchase_id?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_purchase_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_purchase_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchase_attachments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "project_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      project_purchases: {
        Row: {
          activity_id: string | null
          actual_cost: number | null
          actual_delivery_date: string | null
          boleto_code: string | null
          boleto_file_path: string | null
          brand: string | null
          category: string | null
          contract_file_path: string | null
          created_at: string
          created_by: string
          delivery_address: string | null
          delivery_location: string | null
          description: string | null
          end_date: string | null
          estimated_cost: number | null
          expected_delivery_date: string | null
          fornecedor_id: string | null
          id: string
          invoice_file_path: string | null
          invoice_number: string | null
          item_name: string
          lead_time_days: number
          notes: string | null
          orcamento_item_id: string | null
          order_date: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_due_date: string | null
          payment_method: string | null
          pix_key: string | null
          planned_purchase_date: string | null
          project_id: string
          purchase_type: string | null
          quantity: number
          required_by_date: string
          shipping_cost: number | null
          start_date: string | null
          status: string
          stock_entry_date: string | null
          stock_exit_date: string | null
          supplier_contact: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          actual_cost?: number | null
          actual_delivery_date?: string | null
          boleto_code?: string | null
          boleto_file_path?: string | null
          brand?: string | null
          category?: string | null
          contract_file_path?: string | null
          created_at?: string
          created_by: string
          delivery_address?: string | null
          delivery_location?: string | null
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_delivery_date?: string | null
          fornecedor_id?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_number?: string | null
          item_name: string
          lead_time_days?: number
          notes?: string | null
          orcamento_item_id?: string | null
          order_date?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          pix_key?: string | null
          planned_purchase_date?: string | null
          project_id: string
          purchase_type?: string | null
          quantity?: number
          required_by_date: string
          shipping_cost?: number | null
          start_date?: string | null
          status?: string
          stock_entry_date?: string | null
          stock_exit_date?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          actual_cost?: number | null
          actual_delivery_date?: string | null
          boleto_code?: string | null
          boleto_file_path?: string | null
          brand?: string | null
          category?: string | null
          contract_file_path?: string | null
          created_at?: string
          created_by?: string
          delivery_address?: string | null
          delivery_location?: string | null
          description?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_delivery_date?: string | null
          fornecedor_id?: string | null
          id?: string
          invoice_file_path?: string | null
          invoice_number?: string | null
          item_name?: string
          lead_time_days?: number
          notes?: string | null
          orcamento_item_id?: string | null
          order_date?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          pix_key?: string | null
          planned_purchase_date?: string | null
          project_id?: string
          purchase_type?: string | null
          quantity?: number
          required_by_date?: string
          shipping_cost?: number | null
          start_date?: string | null
          status?: string
          stock_entry_date?: string | null
          stock_exit_date?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_purchases_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchases_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchases_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: true
            referencedRelation: "orcamento_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_studio_info: {
        Row: {
          allowed_work_days: string[] | null
          allowed_work_end_time: string | null
          allowed_work_start_time: string | null
          bairro: string | null
          building_manager_email: string | null
          building_manager_name: string | null
          building_manager_phone: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          data_recebimento_chaves: string | null
          electronic_lock_password: string | null
          endereco_completo: string | null
          key_location: string | null
          nome_do_empreendimento: string | null
          project_id: string
          provider_access_instructions: string | null
          syndic_email: string | null
          syndic_name: string | null
          syndic_phone: string | null
          tamanho_imovel_m2: number | null
          tipo_de_locacao: string | null
          updated_at: string
        }
        Insert: {
          allowed_work_days?: string[] | null
          allowed_work_end_time?: string | null
          allowed_work_start_time?: string | null
          bairro?: string | null
          building_manager_email?: string | null
          building_manager_name?: string | null
          building_manager_phone?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_recebimento_chaves?: string | null
          electronic_lock_password?: string | null
          endereco_completo?: string | null
          key_location?: string | null
          nome_do_empreendimento?: string | null
          project_id: string
          provider_access_instructions?: string | null
          syndic_email?: string | null
          syndic_name?: string | null
          syndic_phone?: string | null
          tamanho_imovel_m2?: number | null
          tipo_de_locacao?: string | null
          updated_at?: string
        }
        Update: {
          allowed_work_days?: string[] | null
          allowed_work_end_time?: string | null
          allowed_work_start_time?: string | null
          bairro?: string | null
          building_manager_email?: string | null
          building_manager_name?: string | null
          building_manager_phone?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_recebimento_chaves?: string | null
          electronic_lock_password?: string | null
          endereco_completo?: string | null
          key_location?: string | null
          nome_do_empreendimento?: string | null
          project_id?: string
          provider_access_instructions?: string | null
          syndic_email?: string | null
          syndic_name?: string | null
          syndic_phone?: string | null
          tamanho_imovel_m2?: number | null
          tipo_de_locacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_studio_info_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_studio_info_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_contacts: {
        Row: {
          crea: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          phone: string | null
          photo_url: string | null
          project_id: string
          role_type: string
          updated_at: string
        }
        Insert: {
          crea?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          project_id: string
          role_type: string
          updated_at?: string
        }
        Update: {
          crea?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          project_id?: string
          role_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_team_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_versions: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          custom_fields: Json | null
          default_activities: Json | null
          default_contract_value: number | null
          description: string | null
          id: string
          is_project_phase: boolean
          name: string
          template_id: string
          version_number: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json | null
          default_activities?: Json | null
          default_contract_value?: number | null
          description?: string | null
          id?: string
          is_project_phase?: boolean
          name: string
          template_id: string
          version_number?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json | null
          default_activities?: Json | null
          default_contract_value?: number | null
          description?: string | null
          id?: string
          is_project_phase?: boolean
          name?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          custom_fields: Json | null
          default_activities: Json | null
          default_contract_value: number | null
          description: string | null
          id: string
          is_project_phase: boolean
          last_used_at: string | null
          name: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json | null
          default_activities?: Json | null
          default_contract_value?: number | null
          description?: string | null
          id?: string
          is_project_phase?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json | null
          default_activities?: Json | null
          default_contract_value?: number | null
          description?: string | null
          id?: string
          is_project_phase?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          address: string | null
          bairro: string | null
          budget_code: string | null
          budget_value: number | null
          cep: string | null
          city: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          condominium: string | null
          consultora_comercial: string | null
          contract_signing_date: string | null
          contract_value: number | null
          created_at: string
          created_by: string
          date_approval_3d: string | null
          date_approval_exec: string | null
          date_approval_obra: string | null
          date_briefing_arch: string | null
          date_mobilization_start: string | null
          date_official_delivery: string | null
          date_official_start: string | null
          deleted_at: string | null
          estimated_duration_weeks: number | null
          external_id: string | null
          external_system: string | null
          id: string
          is_project_phase: boolean
          name: string
          neighborhood: string | null
          notes: string | null
          org_id: string | null
          painel_etapa: Database["public"]["Enums"]["painel_etapa_enum"] | null
          painel_external_budget_id: string | null
          painel_inicio_etapa: string | null
          painel_prazo: string | null
          painel_previsao_avanco: string | null
          painel_relacionamento:
            | Database["public"]["Enums"]["painel_relacionamento_enum"]
            | null
          painel_responsavel_id: string | null
          painel_status:
            | Database["public"]["Enums"]["painel_status_enum"]
            | null
          painel_ultima_atualizacao: string
          planned_end_date: string | null
          planned_start_date: string | null
          property_type: string | null
          status: string
          total_area: number | null
          unit_name: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address?: string | null
          bairro?: string | null
          budget_code?: string | null
          budget_value?: number | null
          cep?: string | null
          city?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          condominium?: string | null
          consultora_comercial?: string | null
          contract_signing_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by: string
          date_approval_3d?: string | null
          date_approval_exec?: string | null
          date_approval_obra?: string | null
          date_briefing_arch?: string | null
          date_mobilization_start?: string | null
          date_official_delivery?: string | null
          date_official_start?: string | null
          deleted_at?: string | null
          estimated_duration_weeks?: number | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          is_project_phase?: boolean
          name: string
          neighborhood?: string | null
          notes?: string | null
          org_id?: string | null
          painel_etapa?: Database["public"]["Enums"]["painel_etapa_enum"] | null
          painel_external_budget_id?: string | null
          painel_inicio_etapa?: string | null
          painel_prazo?: string | null
          painel_previsao_avanco?: string | null
          painel_relacionamento?:
            | Database["public"]["Enums"]["painel_relacionamento_enum"]
            | null
          painel_responsavel_id?: string | null
          painel_status?:
            | Database["public"]["Enums"]["painel_status_enum"]
            | null
          painel_ultima_atualizacao?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          property_type?: string | null
          status?: string
          total_area?: number | null
          unit_name?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address?: string | null
          bairro?: string | null
          budget_code?: string | null
          budget_value?: number | null
          cep?: string | null
          city?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          condominium?: string | null
          consultora_comercial?: string | null
          contract_signing_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string
          date_approval_3d?: string | null
          date_approval_exec?: string | null
          date_approval_obra?: string | null
          date_briefing_arch?: string | null
          date_mobilization_start?: string | null
          date_official_delivery?: string | null
          date_official_start?: string | null
          deleted_at?: string | null
          estimated_duration_weeks?: number | null
          external_id?: string | null
          external_system?: string | null
          id?: string
          is_project_phase?: boolean
          name?: string
          neighborhood?: string | null
          notes?: string | null
          org_id?: string | null
          painel_etapa?: Database["public"]["Enums"]["painel_etapa_enum"] | null
          painel_external_budget_id?: string | null
          painel_inicio_etapa?: string | null
          painel_prazo?: string | null
          painel_previsao_avanco?: string | null
          painel_relacionamento?:
            | Database["public"]["Enums"]["painel_relacionamento_enum"]
            | null
          painel_responsavel_id?: string | null
          painel_status?:
            | Database["public"]["Enums"]["painel_status_enum"]
            | null
          painel_ultima_atualizacao?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          property_type?: string | null
          status?: string
          total_area?: number | null
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
          {
            foreignKeyName: "projects_painel_responsavel_id_fkey"
            columns: ["painel_responsavel_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payment_flows: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          installment_name: string
          project_id: string
          purchase_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_name: string
          project_id: string
          purchase_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_name?: string
          project_id?: string
          purchase_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payment_flows_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "project_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payment_schedule: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string | null
          id: string
          installment_number: number
          paid_at: string | null
          payment_method: string | null
          percentage: number | null
          purchase_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          paid_at?: string | null
          payment_method?: string | null
          percentage?: number | null
          purchase_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          paid_at?: string | null
          payment_method?: string | null
          percentage?: number | null
          purchase_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payment_schedule_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "project_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_payload: Json
          project_id: string
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_payload?: Json
          project_id: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_payload?: Json
          project_id?: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schedule_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_date_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          stage_date_id: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          stage_date_id: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          stage_date_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_date_events_stage_date_id_fkey"
            columns: ["stage_date_id"]
            isOneToOne: false
            referencedRelation: "stage_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_dates: {
        Row: {
          bwild_confirmed_at: string | null
          bwild_confirmed_by: string | null
          created_at: string
          customer_proposed_at: string | null
          customer_proposed_by: string | null
          date_type: string
          id: string
          notes: string | null
          project_id: string
          stage_key: string
          title: string
          updated_at: string
        }
        Insert: {
          bwild_confirmed_at?: string | null
          bwild_confirmed_by?: string | null
          created_at?: string
          customer_proposed_at?: string | null
          customer_proposed_by?: string | null
          date_type: string
          id?: string
          notes?: string | null
          project_id: string
          stage_key: string
          title: string
          updated_at?: string
        }
        Update: {
          bwild_confirmed_at?: string | null
          bwild_confirmed_by?: string | null
          created_at?: string
          customer_proposed_at?: string | null
          customer_proposed_by?: string | null
          date_type?: string
          id?: string
          notes?: string | null
          project_id?: string
          stage_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_dates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stage_dates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          id: string
          item_id: string
          location_type: string
          project_id: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          location_type: string
          project_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          location_type?: string
          project_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_balances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_quantity: number | null
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number | null
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number | null
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string | null
          item_id: string
          location_type: string
          movement_date: string
          movement_type: string
          notes: string | null
          project_id: string | null
          quantity: number
          reason: string | null
          responsible_user_id: string | null
          supplier_name: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          item_id: string
          location_type: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          project_id?: string | null
          quantity: number
          reason?: string | null
          responsible_user_id?: string | null
          supplier_name?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          item_id?: string
          location_type?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          project_id?: string | null
          quantity?: number
          reason?: string | null
          responsible_user_id?: string | null
          supplier_name?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      user_obra_access: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          permissoes_especificas: Json | null
          role_override: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          permissoes_especificas?: Json | null
          role_override?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          permissoes_especificas?: Json | null
          role_override?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_obra_access_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_obra_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
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
      users_profile: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          empresa: string | null
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          id: string
          nome: string
          perfil?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          available_at: string | null
          created_at: string
          created_by: string | null
          data: Json
          id: string
          project_id: string
          updated_at: string
          updated_by: string | null
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          available_at?: string | null
          created_at?: string
          created_by?: string | null
          data: Json
          id?: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          available_at?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "weekly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      files_cleanup_candidates: {
        Row: {
          bucket: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string | null
          original_name: string | null
          owner_id: string | null
          project_id: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["file_status"] | null
          storage_path: string | null
        }
        Insert: {
          bucket?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string | null
          original_name?: string | null
          owner_id?: string | null
          project_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["file_status"] | null
          storage_path?: string | null
        }
        Update: {
          bucket?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string | null
          original_name?: string | null
          owner_id?: string | null
          project_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["file_status"] | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files_summary: {
        Row: {
          bucket: string | null
          file_count: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["file_status"] | null
          total_size_bytes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_dashboard_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
          error_code: string | null
          first_occurrence: string | null
          last_24h: number | null
          last_hour: number | null
          last_occurrence: string | null
          source: string | null
          total_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_edit_atividades: { Args: { p_obra_id: string }; Returns: boolean }
      can_edit_cronograma: { Args: { p_obra_id: string }; Returns: boolean }
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
      complete_inspection: {
        Args: { p_inspection_id: string }
        Returns: undefined
      }
      compute_formalization_hash: {
        Args: { p_formalization_id: string }
        Returns: string
      }
      create_inspection_with_items: {
        Args: {
          p_activity_id?: string
          p_client_name?: string
          p_client_present?: boolean
          p_inspection_date?: string
          p_inspection_type?: string
          p_inspector_id?: string
          p_items?: Json
          p_notes?: string
          p_project_id: string
        }
        Returns: string
      }
      create_notification: {
        Args: {
          _action_url?: string
          _body?: string
          _project_id?: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      execute_assistant_query: { Args: { p_sql: string }; Returns: Json }
      find_duplicate_file: {
        Args: { p_checksum: string; p_owner_id?: string; p_project_id?: string }
        Returns: {
          bucket: string
          id: string
          storage_path: string
        }[]
      }
      generate_file_storage_path: {
        Args: { p_filename: string; p_org_id: string; p_project_id: string }
        Returns: string
      }
      get_effective_role: { Args: { p_obra_id: string }; Returns: string }
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
          is_project_phase: boolean
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
      hard_delete_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      has_obra_access: { Args: { p_obra_id: string }; Returns: boolean }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_permission: {
        Args: { _permission: string; _project_id: string; _user_id: string }
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
      increment_template_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      initialize_project_journey: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      is_admin_v2: { Args: never; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_read_only: { Args: { p_obra_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_user_active: { Args: never; Returns: boolean }
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
      my_profile_role: { Args: never; Returns: string }
      reorder_project_activities: {
        Args: { p_ordered_ids: string[]; p_project_id: string }
        Returns: undefined
      }
      replace_project_activities: {
        Args: { p_project_id: string; p_rows: Json }
        Returns: undefined
      }
      restore_project: { Args: { p_project_id: string }; Returns: undefined }
      resync_projects_planned_dates: { Args: never; Returns: number }
      save_project_baseline: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      soft_delete_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      sync_budget_items_to_purchases: {
        Args: { p_project_id: string }
        Returns: number
      }
      transition_nc_status:
        | {
            Args: {
              p_corrective_action?: string
              p_evidence_photos_after?: string[]
              p_evidence_photos_before?: string[]
              p_nc_id: string
              p_new_status: Database["public"]["Enums"]["nc_status"]
              p_notes?: string
              p_rejection_reason?: string
              p_resolution_notes?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_corrective_action?: string
              p_evidence_photos_after?: string[]
              p_evidence_photos_before?: string[]
              p_nc_id: string
              p_new_status: string
              p_notes?: string
              p_rejection_reason?: string
              p_resolution_notes?: string
            }
            Returns: undefined
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
      user_must_sign_formalization: {
        Args: { p_formalization_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "engineer"
        | "admin"
        | "customer"
        | "manager"
        | "suprimentos"
        | "financeiro"
        | "gestor"
        | "cs"
        | "arquitetura"
      atividade_prioridade: "baixa" | "media" | "alta"
      atividade_status:
        | "nao_iniciada"
        | "em_andamento"
        | "bloqueada"
        | "concluida"
      auditoria_acao: "create" | "update" | "delete"
      cs_action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      cs_ticket_severity: "baixa" | "media" | "alta" | "critica"
      cs_ticket_status: "aberto" | "em_andamento" | "concluido"
      entidade_tipo: "obra" | "atividade" | "marco" | "cronograma"
      evidence_link_kind:
        | "meeting_recording"
        | "drive_link"
        | "external_doc"
        | "other"
      file_status: "active" | "archived" | "deleted"
      file_visibility: "private" | "team" | "public"
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
      inspection_item_result:
        | "approved"
        | "rejected"
        | "not_applicable"
        | "pending"
      inspection_status: "draft" | "in_progress" | "completed"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      journey_stage_status:
        | "pending"
        | "waiting_action"
        | "in_progress"
        | "completed"
      marco_status: "pendente" | "em_andamento" | "concluido" | "atrasado"
      nc_severity: "low" | "medium" | "high" | "critical"
      nc_status:
        | "open"
        | "in_treatment"
        | "pending_verification"
        | "pending_approval"
        | "closed"
        | "reopened"
      notification_type:
        | "payment_due"
        | "payment_overdue"
        | "formalization_pending"
        | "document_uploaded"
        | "stage_changed"
        | "pending_item_created"
        | "report_published"
        | "general"
        | "nc_created"
        | "nc_status_changed"
        | "nc_pending_approval"
        | "nc_assigned"
      obra_status:
        | "planejamento"
        | "em_andamento"
        | "pausada"
        | "finalizada"
        | "cancelada"
      obra_task_status: "pendente" | "em_andamento" | "pausado" | "concluido"
      orcamento_priority: "low" | "normal" | "high" | "urgent"
      orcamento_status:
        | "requested"
        | "in_progress"
        | "review"
        | "waiting_info"
        | "blocked"
        | "ready"
        | "sent_to_client"
        | "approved"
        | "rejected"
        | "cancelled"
      painel_etapa_enum:
        | "Medição"
        | "Executivo"
        | "Emissão RRT"
        | "Condomínio"
        | "Planejamento"
        | "Mobilização"
        | "Execução"
        | "Vistoria"
        | "Vistoria reprovada"
        | "Finalizada"
      painel_relacionamento_enum:
        | "Normal"
        | "Atrito"
        | "Insatisfeito"
        | "Crítico"
      painel_status_enum: "Em dia" | "Atrasado" | "Paralisada" | "Aguardando"
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
      review_comment_status: "open" | "resolved"
      review_status: "draft" | "in_review" | "approved" | "archived"
      supplier_category:
        | "materiais"
        | "mao_de_obra"
        | "servicos"
        | "equipamentos"
        | "outros"
      user_status: "ativo" | "inativo"
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
        "engineer",
        "admin",
        "customer",
        "manager",
        "suprimentos",
        "financeiro",
        "gestor",
        "cs",
        "arquitetura",
      ],
      atividade_prioridade: ["baixa", "media", "alta"],
      atividade_status: [
        "nao_iniciada",
        "em_andamento",
        "bloqueada",
        "concluida",
      ],
      auditoria_acao: ["create", "update", "delete"],
      cs_action_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      cs_ticket_severity: ["baixa", "media", "alta", "critica"],
      cs_ticket_status: ["aberto", "em_andamento", "concluido"],
      entidade_tipo: ["obra", "atividade", "marco", "cronograma"],
      evidence_link_kind: [
        "meeting_recording",
        "drive_link",
        "external_doc",
        "other",
      ],
      file_status: ["active", "archived", "deleted"],
      file_visibility: ["private", "team", "public"],
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
      inspection_item_result: [
        "approved",
        "rejected",
        "not_applicable",
        "pending",
      ],
      inspection_status: ["draft", "in_progress", "completed"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      journey_stage_status: [
        "pending",
        "waiting_action",
        "in_progress",
        "completed",
      ],
      marco_status: ["pendente", "em_andamento", "concluido", "atrasado"],
      nc_severity: ["low", "medium", "high", "critical"],
      nc_status: [
        "open",
        "in_treatment",
        "pending_verification",
        "pending_approval",
        "closed",
        "reopened",
      ],
      notification_type: [
        "payment_due",
        "payment_overdue",
        "formalization_pending",
        "document_uploaded",
        "stage_changed",
        "pending_item_created",
        "report_published",
        "general",
        "nc_created",
        "nc_status_changed",
        "nc_pending_approval",
        "nc_assigned",
      ],
      obra_status: [
        "planejamento",
        "em_andamento",
        "pausada",
        "finalizada",
        "cancelada",
      ],
      obra_task_status: ["pendente", "em_andamento", "pausado", "concluido"],
      orcamento_priority: ["low", "normal", "high", "urgent"],
      orcamento_status: [
        "requested",
        "in_progress",
        "review",
        "waiting_info",
        "blocked",
        "ready",
        "sent_to_client",
        "approved",
        "rejected",
        "cancelled",
      ],
      painel_etapa_enum: [
        "Medição",
        "Executivo",
        "Emissão RRT",
        "Condomínio",
        "Planejamento",
        "Mobilização",
        "Execução",
        "Vistoria",
        "Vistoria reprovada",
        "Finalizada",
      ],
      painel_relacionamento_enum: [
        "Normal",
        "Atrito",
        "Insatisfeito",
        "Crítico",
      ],
      painel_status_enum: ["Em dia", "Atrasado", "Paralisada", "Aguardando"],
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
      review_comment_status: ["open", "resolved"],
      review_status: ["draft", "in_review", "approved", "archived"],
      supplier_category: [
        "materiais",
        "mao_de_obra",
        "servicos",
        "equipamentos",
        "outros",
      ],
      user_status: ["ativo", "inativo"],
    },
  },
} as const
