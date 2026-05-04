/**
 * ErrorView — estado de erro padronizado, humano e acionável.
 *
 * Visual irmão do EmptyState premium: ícone discreto em superfície sunken,
 * título dominante, descrição breve, ação primária ("Tentar de novo") +
 * ação secundária opcional ("Reportar problema").
 *
 * Use para: queries com erro, ErrorBoundary fallback, falhas de rede, sem
 * permissão (forbidden), sessão expirada, 5xx.
 *
 * Princípios:
 * - Mensagens em pt-BR, sem juridiquês ou jargão técnico (RLS, JWT, Postgres).
 * - Detalhes técnicos ficam atrás de um <details> (apenas para DEV/QA).
 * - Sempre que possível oferecer botão "Tentar de novo".
 */
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  WifiOff,
  Lock,
  ServerCrash,
  Clock,
  KeyRound,
  Search,
  RefreshCw,
  MessageSquareWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserError, UserErrorKind } from '@/lib/errorMapping';

interface ErrorViewProps {
  /** Categoria do erro — direciona ícone e tom. Default: unknown. */
  kind?: UserErrorKind;
  /** Título dominante. Se omitido, usa o default da kind. */
  title?: ReactNode;
  /** Mensagem explicando o que aconteceu (já humanizada). */
  description?: ReactNode;
  /** Callback para botão "Tentar de novo". Se omitido, esconde o botão. */
  onRetry?: () => void;
  /** Callback ou href para "Reportar problema". */
  onReport?: () => void;
  /** ID de correlação para suporte (apenas exibido em pequena fonte). */
  correlationId?: string;
  /** Detalhes técnicos — exibidos apenas em DEV dentro de <details>. */
  technicalDetails?: string;
  /** Esconde container/borda — útil dentro de SectionCard. */
  bare?: boolean;
  /** Tamanho do bloco. Default: md. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const kindConfig: Record<
  UserErrorKind,
  { icon: typeof AlertTriangle; defaultTitle: string }
> = {
  forbidden: { icon: Lock, defaultTitle: 'Sem acesso a este conteúdo' },
  auth: { icon: KeyRound, defaultTitle: 'Sessão expirada' },
  server: { icon: ServerCrash, defaultTitle: 'Problema no servidor' },
  network: { icon: WifiOff, defaultTitle: 'Sem conexão' },
  conflict: { icon: AlertTriangle, defaultTitle: 'Dados conflitantes' },
  not_found: { icon: Search, defaultTitle: 'Não encontramos o que você procura' },
  validation: { icon: AlertTriangle, defaultTitle: 'Dados inválidos' },
  rate_limit: { icon: Clock, defaultTitle: 'Muitas tentativas' },
  storage: { icon: AlertTriangle, defaultTitle: 'Problema com o arquivo' },
  unknown: { icon: AlertTriangle, defaultTitle: 'Algo deu errado' },
};

const sizeConfig = {
  sm: {
    padding: 'py-8 px-4',
    iconBox: 'h-10 w-10',
    iconSize: 'h-5 w-5',
    title: 'text-sm',
    desc: 'text-xs max-w-xs',
  },
  md: {
    padding: 'py-12 px-6',
    iconBox: 'h-12 w-12',
    iconSize: 'h-6 w-6',
    title: 'text-base',
    desc: 'text-sm max-w-sm',
  },
  lg: {
    padding: 'py-16 px-8',
    iconBox: 'h-14 w-14',
    iconSize: 'h-7 w-7',
    title: 'text-lg',
    desc: 'text-sm max-w-md',
  },
};

export function ErrorView({
  kind = 'unknown',
  title,
  description,
  onRetry,
  onReport,
  correlationId,
  technicalDetails,
  bare = false,
  size = 'md',
  className,
}: ErrorViewProps) {
  const cfg = sizeConfig[size];
  const { icon: Icon, defaultTitle } = kindConfig[kind];
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        cfg.padding,
        !bare && 'rounded-xl border border-border-subtle bg-surface',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full surface-sunken mb-4',
          cfg.iconBox,
        )}
        aria-hidden
      >
        <Icon className={cn('text-muted-foreground', cfg.iconSize)} />
      </div>

      <h3 className={cn('font-semibold text-foreground leading-tight', cfg.title)}>
        {title ?? defaultTitle}
      </h3>

      {description && (
        <p className={cn('text-muted-foreground leading-relaxed mt-1.5', cfg.desc)}>
          {description}
        </p>
      )}

      {(onRetry || onReport) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {onRetry && (
            <Button onClick={onRetry} size="sm" className="h-9">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Tentar de novo
            </Button>
          )}
          {onReport && (
            <Button onClick={onReport} variant="outline" size="sm" className="h-9">
              <MessageSquareWarning className="h-4 w-4 mr-1.5" />
              Reportar problema
            </Button>
          )}
        </div>
      )}

      {correlationId && (
        <p className="mt-4 text-xs text-muted-foreground/70 font-mono">
          ID: {correlationId}
        </p>
      )}

      {isDev && technicalDetails && (
        <details className="mt-4 max-w-md text-left w-full">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Detalhes técnicos (apenas dev)
          </summary>
          <pre className="mt-2 p-3 surface-sunken rounded-md text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {technicalDetails}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Atalho: monta um ErrorView a partir de um UserError já mapeado.
 */
export function ErrorViewFromUserError({
  error,
  onRetry,
  onReport,
  correlationId,
  bare,
  size,
  className,
}: {
  error: UserError;
  onRetry?: () => void;
  onReport?: () => void;
  correlationId?: string;
  bare?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <ErrorView
      kind={error.kind}
      description={error.userMessage}
      technicalDetails={error.technicalDetails}
      onRetry={onRetry}
      onReport={onReport}
      correlationId={correlationId}
      bare={bare}
      size={size}
      className={className}
    />
  );
}
