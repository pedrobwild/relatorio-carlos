/**
 * BottomCTA — barra de ação primária na thumb-zone do mobile.
 *
 * Em mobile (md), renderiza inline (`inline-flex` no rodapé da seção)
 * para não quebrar o layout.
 *
 * Padrões obrigatórios:
 *  - Respeita `safe-area-inset-bottom` (notch/home indicator do iOS).
 *  - Targets de toque >= 44×44 (`h-12` por default).
 *  - Não use para ações destrutivas — destrutivo vai em overflow/menu.
 *  - Quando `keyboardOpen` é true, esconde a barra (input em foco já tem
 *    botão de envio no rodapé do form).
 *
 * Variantes:
 *  - primary-only: 1 ação dominante, ocupa 100%.
 *  - primary-secondary: ação primária + secundária (60/40).
 */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVisualViewport } from '@/hooks/useVisualViewport';

interface BottomCTAAction {
  label: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Ícone opcional renderizado antes do label. */
  icon?: ReactNode;
  /** aria-label se o label for apenas ícone. */
  ariaLabel?: string;
}

export interface BottomCTAProps {
  primary: BottomCTAAction;
  secondary?: BottomCTAAction;
  /** Esconde a barra quando o teclado virtual está aberto. Default: true. */
  hideOnKeyboard?: boolean;
  /** Em desktop, renderiza inline (não fixo). Default: true. */
  inlineOnDesktop?: boolean;
  className?: string;
}

export function BottomCTA({
  primary,
  secondary,
  hideOnKeyboard = true,
  inlineOnDesktop = true,
  className,
}: BottomCTAProps) {
  const isMobile = useIsMobile();
  const { isKeyboardOpen } = useVisualViewport();

  if (isMobile && hideOnKeyboard && isKeyboardOpen) {
    return null;
  }

  const fixed = isMobile || !inlineOnDesktop;

  return (
    <div
      role="region"
      aria-label="Ações principais"
      className={cn(
        fixed
          ? 'fixed bottom-0 inset-x-0 z-shell bg-background/95 backdrop-blur border-t border-border-subtle px-4 pt-3 pb-3'
          : 'flex justify-end gap-2 pt-4',
        // Safe-area: o pb-3 acima é incremental — env() só ativa no iOS notch.
        fixed && 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <div
        className={cn(
          fixed ? 'mx-auto flex w-full max-w-md items-center gap-2' : 'flex items-center gap-2',
        )}
      >
        {secondary && (
          <Button
            type={secondary.type ?? 'button'}
            form={secondary.form}
            variant="outline"
            onClick={secondary.onClick}
            disabled={secondary.disabled || secondary.loading}
            aria-label={secondary.ariaLabel}
            className={cn(
              'h-12 text-[15px] font-medium',
              fixed ? 'flex-[2]' : '',
            )}
          >
            {secondary.icon}
            {secondary.label}
          </Button>
        )}
        <Button
          type={primary.type ?? 'button'}
          form={primary.form}
          onClick={primary.onClick}
          disabled={primary.disabled || primary.loading}
          aria-label={primary.ariaLabel}
          className={cn(
            'h-12 text-[15px] font-medium',
            fixed ? (secondary ? 'flex-[3]' : 'flex-1 w-full') : '',
          )}
        >
          {primary.icon}
          {primary.label}
        </Button>
      </div>
    </div>
  );
}

/**
 * BottomCTASpacer — spacer invisível para evitar que conteúdo fique
 * atrás da `<BottomCTA fixed>`. Coloque como último filho do scroll
 * container em páginas mobile que usam BottomCTA.
 */
export function BottomCTASpacer({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <div
      aria-hidden
      className={cn('h-[calc(3.5rem+env(safe-area-inset-bottom))]', className)}
    />
  );
}
