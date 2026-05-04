/**
 * PremiumDialogHeader / PremiumSheetHeader — cabeçalhos refinados para
 * Dialogs e Sheets, com ícone opcional, eyebrow, título, descrição e
 * divisão clara entre header e body.
 *
 * Use no lugar do <DialogHeader> shadcn quando quiser hierarquia premium
 * consistente (formulários, drawers de detalhes, modais críticos).
 *
 * Estrutura:
 *  - container com px-6 py-5 e border-b
 *  - linha 1: ícone (opcional, em surface-sunken circle) + eyebrow
 *  - linha 2: título h2 dominante
 *  - linha 3: descrição muted
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface PremiumHeaderProps {
  icon?: LucideIcon;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Quando o header não precisa de borda inferior (use com tabs). */
  flush?: boolean;
}

interface DialogHeaderProps extends PremiumHeaderProps {
  /** Componente Title nativo do framework (Dialog/Sheet) para a11y. */
  TitleComponent?: typeof DialogTitle | typeof SheetTitle;
  DescriptionComponent?: typeof DialogDescription | typeof SheetDescription;
}

function BaseHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  className,
  flush,
  TitleComponent = DialogTitle,
  DescriptionComponent = DialogDescription,
}: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-5",
        !flush && "border-b border-border-subtle",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full surface-sunken shrink-0"
          >
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow && (
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </span>
          )}
          <TitleComponent className="text-lg font-semibold text-foreground leading-tight tracking-tight">
            {title}
          </TitleComponent>
          {description && (
            <DescriptionComponent className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DescriptionComponent>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export function PremiumDialogHeader(props: PremiumHeaderProps) {
  return (
    <BaseHeader
      {...props}
      TitleComponent={DialogTitle}
      DescriptionComponent={DialogDescription}
    />
  );
}

export function PremiumSheetHeader(props: PremiumHeaderProps) {
  return (
    <BaseHeader
      {...props}
      TitleComponent={SheetTitle}
      DescriptionComponent={SheetDescription}
    />
  );
}

interface PremiumFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Footer padronizado para dialogs/sheets — encosta no fim com border-top
 * sutil e padding consistente. Botões à direita.
 */
export function PremiumDialogFooter({
  children,
  className,
}: PremiumFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-border-subtle surface-sunken",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Body padronizado: padding consistente, scroll interno se necessário.
 */
export function PremiumDialogBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}
