import { ReactNode } from 'react';
import { LucideIcon, FileX, FolderOpen, Calendar, ClipboardList, ShoppingCart, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * @deprecated Use `EmptyState` de `@/components/ui-premium` para novos usos.
 * Este componente é o legacy mantido apenas por compatibilidade com pages
 * que ainda não migraram. Novos usos devem importar de `ui-premium` —
 * a versão premium tem padrões consistentes com o design system (tokens,
 * tamanhos, container) e suporta `bare`, `size` e `footer`.
 */
export type EmptyStateVariant = 
  | 'documents'
  | 'formalizations'
  | 'schedule'
  | 'purchases'
  | 'payments'
  | 'generic';

interface EmptyStateProps {
  /** Variant determines the icon and default messaging */
  variant?: EmptyStateVariant;
  /** Custom icon - overrides variant icon */
  icon?: LucideIcon;
  /** Main title */
  title: string;
  /** Description text */
  description?: string;
  /** Contextual hint explaining WHY something isn't available yet (evolutionary empty state) */
  hint?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action link */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Info/FAQ link shown below description */
  infoLink?: {
    label: string;
    href: string;
  };
  /** Additional content below description */
  children?: ReactNode;
  /** Custom className */
  className?: string;
  /** Compact mode for inline usage */
  compact?: boolean;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  documents: FileX,
  formalizations: ClipboardList,
  schedule: Calendar,
  purchases: ShoppingCart,
  payments: CreditCard,
  generic: FolderOpen,
};

/**
 * @deprecated Use o `EmptyState` de `@/components/ui-premium`.
 */
export function EmptyState({
  variant = 'generic',
  icon,
  title,
  description,
  hint,
  action,
  secondaryAction,
  infoLink,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
      role="status"
      aria-label={title}
    >
      <div
        className={cn(
          'rounded-full bg-muted/50 flex items-center justify-center mb-4',
          compact ? 'h-12 w-12' : 'h-16 w-16'
        )}
      >
        <Icon
          className={cn(
            'text-muted-foreground/50',
            compact ? 'h-6 w-6' : 'h-8 w-8'
          )}
          aria-hidden="true"
        />
      </div>

      <h3
        className={cn(
          'font-medium text-foreground',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-sm',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {description}
        </p>
      )}

      {hint && (
        <div className={cn(
          "mt-3 max-w-sm rounded-lg bg-info-light border border-info/10 text-info",
          compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
        )}>
          <p className="leading-relaxed">{hint}</p>
        </div>
      )}

      {infoLink && (
        <a
          href={infoLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 mt-3 text-primary hover:text-primary/80 transition-colors font-medium",
            compact ? "text-xs" : "text-sm"
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {infoLink.label}
        </a>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {action && (
            <Button
              onClick={action.onClick}
              size={compact ? 'sm' : 'default'}
              className="gap-2"
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              size={compact ? 'sm' : 'default'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
