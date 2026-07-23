/**
 * InboxItem — card padrão dos itens da Minha Semana.
 *
 * Sinaliza urgência via cor semântica no badge de prazo. Toque grande (44px)
 * garante uso confortável em mobile. Clicável em qualquer área.
 */
import { Link } from "react-router-dom";
import {
  ClipboardList,
  AlertTriangle,
  Headset,
  FileSignature,
  Bell,
  ListTodo,
  KeySquare,
  ShoppingCart,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";


import { cn } from "@/lib/utils";
import type { InboxItem as InboxItemType, InboxKind } from "@/hooks/useMinhaSemana";

const KIND_META: Record<
  InboxKind,
  { label: string; icon: LucideIcon; tone: string }
> = {
  atividade: {
    label: "Atividade",
    icon: ClipboardList,
    tone: "bg-primary/10 text-primary border-primary/20",
  },
  nc: {
    label: "NC",
    icon: AlertTriangle,
    tone: "bg-warning/10 text-warning border-warning/25",
  },
  ticket: {
    label: "Ticket",
    icon: Headset,
    tone: "bg-info/10 text-info border-info/25",
  },
  formalizacao: {
    label: "Formalização",
    icon: FileSignature,
    tone: "bg-accent/60 text-foreground border-border",
  },
  alerta: {
    label: "Alerta",
    icon: Bell,
    tone: "bg-warning/10 text-warning border-warning/25",
  },
  pendencia: {
    label: "Pendência",
    icon: ListTodo,
    tone: "bg-muted text-muted-foreground border-border",
  },
  entrega: {
    label: "Pendência de entrega",
    icon: KeySquare,
    tone: "bg-accent/40 text-foreground border-border",
  },
};


function formatDeadline(item: InboxItemType): string {
  if (item.daysOverdue > 0) {
    return `${item.daysOverdue} ${item.daysOverdue === 1 ? "dia útil de atraso" : "dias úteis de atraso"}`;
  }
  if (item.businessDaysUntil == null) return "sem prazo";
  if (item.businessDaysUntil === 0) return "hoje";
  if (item.businessDaysUntil === 1) return "em 1 dia útil";
  return `em ${item.businessDaysUntil} dias úteis`;
}

interface Props {
  item: InboxItemType;
}

export function InboxItem({ item }: Props) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const overdue = item.daysOverdue > 0;

  return (
    <Link
      to={item.href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border-subtle bg-card p-3 min-h-[64px]",
        "hover:border-primary/30 hover:bg-accent/30 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <span
        className={cn(
          "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md border",
          meta.tone,
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {meta.label}
          </span>
          <span
            className="truncate max-w-[220px] text-[11px] font-medium text-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded"
            title={item.projectName}
          >
            {item.projectName}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
          {item.title}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "font-medium tabular-nums",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {formatDeadline(item)}
          </span>
          {item.hint && (
            <>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground truncate">
                {item.hint}
              </span>
            </>
          )}
        </div>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors mt-1"
        aria-hidden="true"
      />
    </Link>
  );
}
