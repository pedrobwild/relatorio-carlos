// Enum types
export type FormalizationType =
  | "budget_item_swap"
  | "meeting_minutes"
  | "exception_custody"
  | "scope_change"
  | "general";
export type FormalizationStatus =
  | "draft"
  | "pending_signatures"
  | "signed"
  | "voided";
export type PartyType = "customer" | "company";
export type EvidenceLinkKind =
  | "meeting_recording"
  | "drive_link"
  | "external_doc"
  | "other";
export type FormalizationEventType =
  | "created"
  | "updated"
  | "sent_for_signature"
  | "signed_by_party"
  | "locked"
  | "voided"
  | "evidence_added"
  | "attachment_added";

// Main formalization record
export interface Formalization {
  id: string;
  customer_org_id: string;
  project_id: string | null;
  unit_id: string | null;
  type: FormalizationType;
  title: string;
  summary: string;
  body_md: string;
  data: Record<string, unknown>;
  status: FormalizationStatus;
  created_by: string;
  locked_at: string | null;
  locked_hash: string | null;
  prev_hash: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

// Party that needs to sign/acknowledge
export interface FormalizationParty {
  id: string;
  formalization_id: string;
  party_type: PartyType;
  display_name: string;
  user_id: string | null;
  email: string | null;
  role_label: string | null;
  must_sign: boolean;
  created_at: string;
}

// Acknowledgement/signature record
export interface FormalizationAcknowledgement {
  id: string;
  formalization_id: string;
  party_id: string;
  acknowledged: boolean;
  acknowledged_at: string;
  acknowledged_by_user_id: string | null;
  acknowledged_by_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  signature_text: string | null;
  signature_hash: string | null;
  created_at: string;
}

// Evidence links (external URLs)
export interface FormalizationEvidenceLink {
  id: string;
  formalization_id: string;
  kind: EvidenceLinkKind;
  url: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

// File attachments
export interface FormalizationAttachment {
  id: string;
  formalization_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

// Audit trail events
export interface FormalizationEvent {
  id: string;
  formalization_id: string;
  event_type: FormalizationEventType;
  actor_user_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// Extended types for UI
export interface FormalizationWithDetails extends Formalization {
  parties: FormalizationParty[];
  acknowledgements: FormalizationAcknowledgement[];
  evidence_links: FormalizationEvidenceLink[];
  attachments: FormalizationAttachment[];
  events: FormalizationEvent[];
}

// Template-specific data structures
export interface BudgetItemSwapData {
  removed_item: {
    name: string;
    description: string;
    value: number;
  };
  added_item: {
    name: string;
    description: string;
    value: number;
  };
  value_difference: number;
  reason: string;
}

export interface MeetingMinutesData {
  meeting_date: string;
  meeting_time: string;
  location: string;
  attendees: Array<{
    name: string;
    role: string;
    email?: string;
  }>;
  agenda: string[];
  decisions: Array<{
    topic: string;
    decision: string;
    responsible?: string;
    deadline?: string;
  }>;
  action_items: Array<{
    description: string;
    responsible: string;
    deadline: string;
  }>;
}

export interface ExceptionCustodyData {
  item_description: string;
  item_model: string;
  item_serial_number?: string;
  custody_start_date: string;
  custody_end_date?: string;
  custodian: {
    name: string;
    document: string;
    role: string;
  };
  condition_on_receipt: string;
  photos_on_receipt: string[];
}

export interface ScopeChangeData {
  original_scope: string;
  new_scope: string;
  reason: string;
  impact_on_timeline: string;
  impact_on_cost: number;
  approval_required_from: string[];
}

// Type labels for display
export const FORMALIZATION_TYPE_LABELS: Record<FormalizationType, string> = {
  budget_item_swap: "Troca de Item de Orçamento",
  meeting_minutes: "Ata de Reunião",
  exception_custody: "Custódia de Item",
  scope_change: "Alteração de Escopo",
  general: "Formalização Geral",
};

export const FORMALIZATION_STATUS_LABELS: Record<FormalizationStatus, string> =
  {
    draft: "Rascunho",
    pending_signatures: "Aguardando Assinaturas",
    signed: "Assinado",
    voided: "Anulado",
  };

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  customer: "Cliente",
  company: "Empresa",
};

export const EVIDENCE_LINK_KIND_LABELS: Record<EvidenceLinkKind, string> = {
  meeting_recording: "Gravação de Reunião",
  drive_link: "Link do Drive",
  external_doc: "Documento Externo",
  other: "Outro",
};

export const FORMALIZATION_EVENT_TYPE_LABELS: Record<
  FormalizationEventType,
  string
> = {
  created: "Criado",
  updated: "Atualizado",
  sent_for_signature: "Enviado para Assinatura",
  signed_by_party: "Assinado por Parte",
  locked: "Bloqueado",
  voided: "Anulado",
  evidence_added: "Evidência Adicionada",
  attachment_added: "Anexo Adicionado",
};
