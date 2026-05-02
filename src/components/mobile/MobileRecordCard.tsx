import { cn } from "@/lib/utils";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MobileRecordCardChip {
  label: string;
  /** Tone — drives bg/text color via tokens. */
  tone?: "neutral" | "info" | "success" | "warning" | "destructive" | "muted";
  /** Optional dot/icon shown to the left of the label. */
  leading?: React.ReactNode;
  title?: string;
}

interface MobileRecordCardProps {
  /** Primary line (cliente / nome do registro). */
  title: string;
  /** Secondary line (obra / unidade / metadado principal). */
  subtitle?: string | null;
  /** Optional eyebrow (responsável, identificador, etc.). */
  eyebrow?: React.ReactNode;
  /** Status / etapa / relacionamento como chips compactos. */
  chips?: MobileRecordCardChip[];
  /** Linha extra opcional (datas, progresso). */
  meta?: React.ReactNode;
  /** Conteúdo do menu de overflow (3 pontinhos). Use DropdownMenuItem. */
  overflowMenu?: React.ReactNode;
  /** Click principal: abre o detalhe do registro. */
  onClick?: () => void;
  /** Aria-label customizado (default: title + subtitle). */
  ariaLabel?: string;
  className?: string;
  /** Mostra chevron à direita (default true quando há onClick). */
  showChevron?: boolean;
  /** Faixa de tonalidade na borda esquerda (urgência/erro). */
  tone?: "default" | "warning" | "destructive" | "success";
}

const chipToneClass: Record<NonNullable<MobileRecordCardChip["tone"]>, string> = {
  neutral:
    "bg-muted/60 text-foreground/80 border border-border-subtle",
  info: "bg-info/10 text-info border border-info/25",
  success: "bg-success/10 text-success border border-success/25",
  warning: "bg-warning/10 text-warning border border-warning/30",
  destructive: "bg-destructive/10 text-destructive border border-destructive/25",
  muted:
    "bg-muted/40 text-muted-foreground border border-dashed border-border",
};

const toneAccent: Record<NonNullable<MobileRecordCardProps["tone"]>, string> = {
  default: "",
  warning: "border-l-2 border-l-warning",
  destructive: "border-l-2 border-l-destructive",
  success: "border-l-2 border-l-success",
};

/**
 * MobileRecordCard — registro empilhado para listagens mobile-first.
 *
 * - Click principal abre o detalhe (onClick); ações secundárias ficam no
 *   menu de overflow (3 pontinhos), nunca competindo com o clique do card.
 * - Chips com tom semântico (status/etapa/relacionamento) sem sobrepor
 *   título/subtítulo (sempre em uma linha dedicada abaixo, com flex-wrap).
 * - Min height 72px para conforto de toque; chevron sinaliza navegação.
 * - Truncamento por linha (não palavra-por-palavra): título e subtítulo
 *   ganham `truncate`, chips usam `whitespace-nowrap` mas envolvem ao
 *   fim da linha.
 */
export function MobileRecordCard({
  title,
  subtitle,
  eyebrow,
  chips,
  meta,
  overflowMenu,
  onClick,
  ariaLabel,
  className,
  showChevron,
  tone = "default",
}: MobileRecordCardProps) {
  const isInteractive = !!onClick;
  const chevron = showChevron ?? isInteractive;

  return (
    <div
      className={cn(
        "relative bg-card border-b border-border-subtle last:border-b-0",
        tone !== "default" && toneAccent[tone],
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!isInteractive}
        aria-label={ariaLabel ?? `${title}${subtitle ? ` — ${subtitle}` : ""}`}
        className={cn(
          "flex items-start gap-3 w-full text-left px-4 py-3 min-h-[72px]",
          // Reservar espaço à direita para o menu de overflow (44px) e/ou
          // chevron — evita sobreposição entre o conteúdo e o botão de ações.
          overflowMenu ? "pr-12" : chevron ? "pr-9" : "pr-4",
          "transition-colors",
          isInteractive && "hover:bg-muted/50 active:bg-muted cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        )}
      >
        <div className="flex-1 min-w-0 space-y-1">
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
              {eyebrow}
            </div>
          )}

          <div className="text-[15px] font-semibold text-foreground leading-snug truncate">
            {title}
          </div>

          {subtitle && (
            <div className="text-[13px] text-muted-foreground leading-snug truncate">
              {subtitle}
            </div>
          )}

          {chips && chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {chips.map((c, i) => (
                <span
                  key={i}
                  title={c.title}
                  className={cn(
                    "inline-flex items-center gap-1 max-w-full rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none",
                    "whitespace-nowrap",
                    chipToneClass[c.tone ?? "neutral"],
                  )}
                >
                  {c.leading}
                  <span className="truncate">{c.label}</span>
                </span>
              ))}
            </div>
          )}

          {meta && (
            <div className="text-[12px] text-muted-foreground pt-0.5">
              {meta}
            </div>
          )}
        </div>

        {chevron && !overflowMenu && (
          <ChevronRight
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>

      {overflowMenu && (
        <div className="absolute right-1 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mais ações"
              className={cn(
                "inline-flex items-center justify-center h-11 w-11 rounded-md text-muted-foreground",
                "hover:bg-muted/70 hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {overflowMenu}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
