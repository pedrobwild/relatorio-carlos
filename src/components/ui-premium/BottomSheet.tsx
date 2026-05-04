/**
 * BottomSheet — sheet inferior para ações de linha em mobile.
 *
 * Substituto natural do `<DropdownMenu>` em mobile: targets de toque
 * grandes (>= 44px), animação slide-up, swipe-down para fechar (via
 * Sheet primitive — radix-dialog em variante bottom).
 *
 * Anatomia:
 *   <BottomSheet open onOpenChange title="Ações">
 *     <BottomSheetItem icon={Edit} onClick={...}>Editar</BottomSheetItem>
 *     <BottomSheetItem icon={Trash} onClick={...} destructive>Excluir</BottomSheetItem>
 *   </BottomSheet>
 *
 * Em desktop, prefira `<DropdownMenu>` (denso, ancorado ao trigger).
 * Use `<ResponsiveActions>` quando quiser que o mesmo conjunto de
 * ações vire DropdownMenu no desktop e BottomSheet no mobile.
 */
import * as React from 'react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn('rounded-t-xl px-4 pt-6 pb-2', className)}>
        {title || description ? (
          <SheetHeader className="mb-3 text-left">
            {title ? <SheetTitle>{title}</SheetTitle> : (
              <VisuallyHidden.Root>
                <SheetTitle>Ações</SheetTitle>
              </VisuallyHidden.Root>
            )}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        ) : (
          <VisuallyHidden.Root>
            <SheetTitle>Ações</SheetTitle>
          </VisuallyHidden.Root>
        )}
        <div role="menu" className="flex flex-col gap-1">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export interface BottomSheetItemProps {
  icon?: LucideIcon;
  onClick?: () => void;
  /** Marca a ação como destrutiva (cor warning/destructive). */
  destructive?: boolean;
  /** Desabilita o item. */
  disabled?: boolean;
  /** Slot trailing — atalho, badge, valor. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * BottomSheetItem — linha de ação dentro de um BottomSheet.
 * Targets de toque >= 48px, `role="menuitem"`.
 */
export function BottomSheetItem({
  icon: Icon,
  onClick,
  destructive,
  disabled,
  trailing,
  children,
  className,
}: BottomSheetItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[48px] w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px]',
        'transition-colors',
        'hover:bg-accent/50 active:bg-accent',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
        className,
      )}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing && <span className="shrink-0 text-muted-foreground">{trailing}</span>}
    </button>
  );
}

/**
 * BottomSheetSeparator — divisor visual entre grupos de ações.
 */
export function BottomSheetSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn('my-1 h-px bg-border-subtle', className)}
      aria-hidden
    />
  );
}
