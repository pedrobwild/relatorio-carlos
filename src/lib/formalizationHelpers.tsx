/**
 * Shared helpers for formalization status/type rendering.
 * Consolidates duplicated code from Formalizacoes, FormalizacoesContent, and Suporte.
 */

import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import type {
  FormalizationStatus,
  FormalizationType,
} from "@/types/formalization";

export const getStatusIcon = (status: FormalizationStatus) => {
  switch (status) {
    case "signed":
      return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />;
    case "pending_signatures":
      return <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />;
    case "draft":
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case "voided":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export const getStatusBadgeVariant = (
  status: FormalizationStatus,
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

export const getTypeIcon = (type: FormalizationType) => {
  switch (type) {
    case "budget_item_swap":
      return "💰";
    case "meeting_minutes":
      return "📝";
    case "exception_custody":
      return "📦";
    case "scope_change":
      return "🔄";
    default:
      return "📄";
  }
};

export const formatFormalizationDate = (dateString: string | null) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatFormalizationDateTime = (dateString: string | null) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
