/**
 * MobileListItem — substituto de linha de tabela em mobile.
 *
 * Anatomia (top-down, dentro de uma área tocável >= 56px):
 *   ┌─────────────────────────────────────────┐
 *   │ [eyebrow]                          [status]
 *   │ title                               (chevron│menu)
 *   │ description
 *   │ ┌─meta─────────────────────────────────────┐
 *   │ │ chip · chip · valor                       │
 *   │ └──────────────────────────────────────────┘
 *   └─────────────────────────────────────────┘
 *
 * Decisões:
 *  - O wrapper é botão (`onClick`) ou link (asChild) — nunca <div>.
 *  - Touch target mínimo 56px (linha) e 44px (botões secundários).
 *  - Toda label clicável tem hit area dedicada.
 */
import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileListItemProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Linha pequena acima do título (categoria, código, breadcrumb). */
  eyebrow?: React.ReactNode;
  /** Slot direito superior — geralmente um StatusBadge. */
  status?: React.ReactNode;
  /** Linha de meta (chips, datas, valores). Renderizada como flex-wrap. */
  meta?: React.ReactNode;
  /** Slot extra no rodapé do card (ex.: footer de ações secundárias). */
  footer?: React.ReactNode;
  /**
   * Toque na linha inteira. Se omitido, a linha não é interativa
   * (use para listas read-only).
   */
  onClick?: () => void;
  /** Mostra chevron à direita (default true quando há onClick). */
  showChevron?: boolean;
  /** Slot trailing custom (substitui o chevron). */
  trailing?: React.ReactNode;
  className?: string;
}

export function MobileListItem({
  title,
  description,
  eyebrow,
  status,
  meta,
  footer,
  onClick,
  showChevron,
  trailing,
  className,
}: MobileListItemProps) {
  const interactive = typeof onClick === 'function';
  const Wrapper = interactive ? 'button' : 'div';
  const chevron = showChevron ?? interactive;

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3.5 text-left',
        'min-h-[56px]',
        interactive &&
          'transition-colors hover:bg-accent/40 active:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {(eyebrow || status) && (
          <div className="flex items-start justify-between gap-2 mb-0.5">
            {eyebrow && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {eyebrow}
              </span>
            )}
            {status && <div className="shrink-0">{status}</div>}
          </div>
        )}
        <div className="text-[15px] font-semibold text-foreground leading-snug break-words">
          {title}
        </div>
        {description && (
          <div className="text-sm text-muted-foreground leading-snug mt-0.5 break-words">
            {description}
          </div>
        )}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {meta}
          </div>
        )}
        {footer && <div className="mt-3">{footer}</div>}
      </div>
      {(trailing || chevron) && (
        <div className="shrink-0 self-center text-muted-foreground">
          {trailing ?? <ChevronRight className="h-5 w-5" aria-hidden />}
        </div>
      )}
    </Wrapper>
  );
}

/**
 * MobileList — wrapper semântico (`<ul>`) para uma lista de itens.
 * Aplica spacing vertical mínimo de 8px entre toques (acessibilidade).
 */
export function MobileList({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className={cn('flex flex-col gap-2', className)}
    >
      {React.Children.map(children, (child, idx) => (
        <li key={idx}>{child}</li>
      ))}
    </ul>
  );
}
