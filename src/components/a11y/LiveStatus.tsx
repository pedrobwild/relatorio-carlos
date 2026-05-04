import type { ReactNode } from 'react';

type Politeness = 'polite' | 'assertive' | 'off';

interface LiveStatusProps {
  /** Mensagem a anunciar. Vazio = silêncio. */
  children?: ReactNode;
  /** `polite` (default) deixa o leitor de tela terminar a fala atual. */
  politeness?: Politeness;
  /** Atomic = lê toda a região mesmo se só parte mudou (recomendado). */
  atomic?: boolean;
  /** Esconde visualmente, mantém para SR. Default true. */
  visuallyHidden?: boolean;
  className?: string;
}

/**
 * Região live para anúncios de status assíncrono (salvar relatório, importar
 * cronograma, sincronização, etc.). Toasts Sonner já são live por padrão, mas
 * estados internos persistentes (`isSaving`, `isImporting`) precisam de uma
 * região dedicada para que leitores de tela como NVDA/VoiceOver narrem a
 * mudança quando o estado completar.
 *
 * @example
 *   <LiveStatus>
 *     {isSaving ? 'Salvando relatório…' : savedAt ? `Salvo às ${savedAt}` : null}
 *   </LiveStatus>
 */
export function LiveStatus({
  children,
  politeness = 'polite',
  atomic = true,
  visuallyHidden = true,
  className,
}: LiveStatusProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic ? 'true' : 'false'}
      className={
        visuallyHidden
          ? `sr-only ${className ?? ''}`.trim()
          : className
      }
    >
      {children}
    </div>
  );
}

/**
 * Variante para erros / mensagens críticas. Usa `role="alert"` (assertivo,
 * interrompe a fala atual) — usar com moderação.
 */
export function LiveAlert({
  children,
  visuallyHidden = false,
  className,
}: Omit<LiveStatusProps, 'politeness' | 'atomic'>) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={
        visuallyHidden
          ? `sr-only ${className ?? ''}`.trim()
          : className
      }
    >
      {children}
    </div>
  );
}
