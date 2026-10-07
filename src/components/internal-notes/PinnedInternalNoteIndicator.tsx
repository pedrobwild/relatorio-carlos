/**
 * PinnedInternalNoteIndicator — selo compacto com a observação interna
 * fixada ("status atual") de uma obra, para listas de staff (Painel de
 * Obras, CS). O texto completo aparece no tooltip.
 *
 * Recebe a nota já carregada (ver `usePinnedInternalNotes`) para não gerar
 * uma query por linha. Sem nota, não renderiza nada.
 */
import { StickyNote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectInternalNote } from "@/infra/repositories";
import {
  formatNoteDateTime,
  getInternalNoteCategoryMeta,
} from "./internalNoteMeta";

export interface PinnedInternalNoteIndicatorProps {
  note: ProjectInternalNote | null | undefined;
  /** "badge" mostra o rótulo da categoria; "icon" só o ícone. */
  variant?: "badge" | "icon";
  className?: string;
}

export function PinnedInternalNoteIndicator({
  note,
  variant = "badge",
  className,
}: PinnedInternalNoteIndicatorProps) {
  if (!note) return null;
  const meta = getInternalNoteCategoryMeta(note.category);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="note"
          aria-label={`Observação interna: ${meta.label}. ${note.body}`}
          className={cn(
            "inline-flex items-center gap-1 rounded font-medium cursor-help",
            "bg-warning/10 text-warning border border-warning/30",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === "badge"
              ? "h-4 px-1.5 text-[10px] whitespace-nowrap"
              : "h-5 w-5 justify-center",
            className,
          )}
          // Fica dentro de linhas/cards clicáveis (Painel, CS): nem clique
          // nem Enter/Espaço no selo podem abrir a obra.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
        >
          <StickyNote
            className={variant === "badge" ? "h-2.5 w-2.5" : "h-3 w-3"}
            aria-hidden
          />
          {variant === "badge" && <span>{meta.label}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px] text-xs">
        <div className="font-semibold mb-1">
          Observação interna · {meta.label}
        </div>
        <p className="whitespace-pre-wrap break-words line-clamp-[8]">{note.body}</p>
        <div className="mt-1.5 text-muted-foreground">
          {note.author_name || "Colaborador"} ·{" "}
          {formatNoteDateTime(note.created_at)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
