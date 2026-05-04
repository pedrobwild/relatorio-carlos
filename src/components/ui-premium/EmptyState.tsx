/**
 * EmptyState — estado vazio premium e padronizado.
 *
 * Padrão Linear/Notion: ícone discreto em superfície sunken circular,
 * título dominante curto, descrição 1-2 linhas, ações claras.
 *
 * Variantes:
 *  - default: borda subtle, fundo surface
 *  - bare:    sem container (use dentro de SectionCard)
 *
 * Use para: sem dados, sem permissão, filtros sem resultado, primeira vez.
 */
import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Conteúdo customizado abaixo das ações (ex: link, helper). */
  footer?: ReactNode;
  className?: string;
  /** Sem container — útil dentro de SectionCard ou DataTable wrapper. */
  bare?: boolean;
  /** Tamanho do bloco. Default: md */
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    padding: "py-8 px-4",
    iconBox: "h-10 w-10",
    iconSize: "h-5 w-5",
    title: "text-sm",
    desc: "text-xs max-w-xs",
  },
  md: {
    padding: "py-12 px-6",
    iconBox: "h-12 w-12",
    iconSize: "h-6 w-6",
    title: "text-base",
    desc: "text-sm max-w-sm",
  },
  lg: {
    padding: "py-16 px-8",
    iconBox: "h-14 w-14",
    iconSize: "h-7 w-7",
    title: "text-lg",
    desc: "text-sm max-w-md",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  footer,
  className,
  bare = false,
  size = "md",
}: EmptyStateProps) {
  const cfg = sizeConfig[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        cfg.padding,
        !bare && "rounded-xl border border-border-subtle bg-surface",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full surface-sunken mb-4",
            cfg.iconBox,
          )}
          aria-hidden
        >
          <Icon className={cn("text-muted-foreground", cfg.iconSize)} />
        </div>
      )}
      <h3
        className={cn("font-semibold text-foreground leading-tight", cfg.title)}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground leading-relaxed mt-1.5",
            cfg.desc,
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant ?? "default"}
              size="sm"
              className="h-9"
            >
              {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant ?? "outline"}
              size="sm"
              className="h-9"
            >
              {secondaryAction.icon && (
                <secondaryAction.icon className="h-4 w-4 mr-1.5" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {footer && (
        <div className="mt-4 text-xs text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}
