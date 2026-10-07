/**
 * Rótulos e cores das categorias de observação interna.
 * Fonte única para o card da obra, o Painel de Obras e as telas de CS.
 */
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InternalNoteCategory } from "@/infra/repositories";

export const INTERNAL_NOTE_CATEGORY_META: Record<
  InternalNoteCategory,
  { label: string; tone: string }
> = {
  sem_atualizacao: {
    label: "Sem atualização",
    tone: "bg-warning/10 text-warning border border-warning/30",
  },
  aguardando_cliente: {
    label: "Aguardando cliente",
    tone: "bg-info/10 text-info border border-info/25",
  },
  aguardando_material: {
    label: "Aguardando material",
    tone: "bg-info/10 text-info border border-info/25",
  },
  obra_pausada: {
    label: "Obra pausada",
    tone: "bg-destructive/10 text-destructive border border-destructive/25",
  },
  outro: {
    label: "Outro",
    tone: "bg-muted text-muted-foreground border border-border",
  },
};

export function getInternalNoteCategoryMeta(category: string) {
  return (
    INTERNAL_NOTE_CATEGORY_META[category as InternalNoteCategory] ??
    INTERNAL_NOTE_CATEGORY_META.outro
  );
}

export function formatNoteDateTime(iso: string) {
  return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatNoteRelative(iso: string) {
  return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
}

export function getAuthorInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}
