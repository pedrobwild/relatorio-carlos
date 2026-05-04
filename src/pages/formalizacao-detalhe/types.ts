export interface PartyRow {
  id: string;
  user_id: string | null;
  email: string | null;
  party_type: "customer" | "company";
  must_sign: boolean;
  display_name: string;
  role_label: string | null;
}

export interface AckRow {
  id: string;
  party_id: string;
  acknowledged: boolean;
  acknowledged_at: string;
  acknowledged_by_email: string | null;
  acknowledged_by_user_id: string | null;
  signature_hash: string | null;
  signature_text: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

export interface EventRow {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface EvidenceLinkRow {
  id: string;
  kind: string;
  url: string;
  description: string | null;
  created_at: string;
}

export const getStatusBadgeVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "signed":
      return "default";
    case "pending_signatures":
      return "secondary";
    case "voided":
      return "destructive";
    default:
      return "outline";
  }
};

export const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const isSeedData = (formalization: any) => {
  if (!formalization) return false;
  if (formalization.customer_org_id === null) return true;
  const id = formalization.id;
  if (id && /[g-z]/i.test(id.substring(0, 8))) return true;
  return false;
};
