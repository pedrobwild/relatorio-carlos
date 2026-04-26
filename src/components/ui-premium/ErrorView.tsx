/**
 * ErrorView — fallback humanizado para falhas de carregamento ou render.
 *
 * Use em conjunto com:
 *   - `mapError(err)` para transformar erros técnicos em `kind` + mensagem.
 *   - ErrorBoundary (fallback prop) para crashes de render.
 *   - React Query (`error` state) para falhas de fetch.
 *
 * Princípios:
 *  - Mensagem em pt-BR, voz BWild (curta, humana, sem juridiquês).
 *  - Nunca expor stack traces, IDs internos ou termos técnicos ao usuário.
 *  - Sempre oferecer um próximo passo claro (Tentar de novo / Reportar).
 */
import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, Lock, RefreshCw, ServerCrash, WifiOff, FileQuestion, MailQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ErrorViewKind = 'forbidden' | 'server' | 'network' | 'auth' | 'notFound' | 'unknown';

interface ErrorViewProps {
  kind?: ErrorViewKind;
  /** Sobrescreve o título padrão do `kind`. */
  title?: ReactNode;
  /** Sobrescreve a descrição padrão do `kind`. */
  description?: ReactNode;
  /** Handler do botão primário "Tentar de novo". Omita para esconder. */
  onRetry?: () => void;
  /** Handler do link "Reportar problema". Omita para esconder. */
  onReport?: () => void;
  /** ID público de correlação (curto). NUNCA exibir IDs internos. */
  errorId?: string;
  /** Sem container — útil dentro de SectionCard ou DataTable wrapper. */
  bare?: boolean;
  /** Tamanho do bloco. Default: md */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const kindConfig: Record<
  ErrorViewKind,
  { icon: ComponentType<{ className?: string }>; title: string; description: string; tone: 'warn' | 'danger' }
> = {
  forbidden: {
    icon: Lock,
    title: 'Sem permissão',
    description: 'Você não tem permissão para ver este conteúdo. Fale com o gestor para liberar.',
    tone: 'warn',
  },
  server: {
    icon: ServerCrash,
    title: 'Tivemos um problema no servidor',
    description: 'Estamos trabalhando para resolver. Tente de novo em alguns instantes.',
    tone: 'danger',
  },
  network: {
    icon: WifiOff,
    title: 'Sem conexão',
    description: 'A conexão está lenta ou indisponível. Verifique a internet e tente de novo.',
    tone: 'warn',
  },
  auth: {
    icon: Lock,
    title: 'Sua sessão expirou',
    description: 'Para continuar, entre novamente.',
    tone: 'warn',
  },
  notFound: {
    icon: FileQuestion,
    title: 'Não encontramos isso',
    description: 'O conteúdo pode ter sido removido ou movido.',
    tone: 'warn',
  },
  unknown: {
    icon: AlertTriangle,
    title: 'Algo não saiu como esperado',
    description: 'Tente de novo. Se o problema continuar, reporte para a gente.',
    tone: 'danger',
  },
};

const sizeConfig = {
  sm: { padding: 'py-8 px-4', iconBox: 'h-10 w-10', iconSize: 'h-5 w-5', title: 'text-sm', desc: 'text-xs max-w-xs' },
  md: { padding: 'py-12 px-6', iconBox: 'h-12 w-12', iconSize: 'h-6 w-6', title: 'text-base', desc: 'text-sm max-w-sm' },
  lg: { padding: 'py-16 px-8', iconBox: 'h-14 w-14', iconSize: 'h-7 w-7', title: 'text-lg', desc: 'text-sm max-w-md' },
};

export function ErrorView({
  kind = 'unknown',
  title,
  description,
  onRetry,
  onReport,
  errorId,
  bare = false,
  size = 'md',
  className,
}: ErrorViewProps) {
  const cfg = kindConfig[kind];
  const sz = sizeConfig[size];
  const Icon = cfg.icon;
  const toneClass =
    cfg.tone === 'danger'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sz.padding,
        !bare && 'rounded-xl border border-border-subtle bg-surface',
        className,
      )}
    >
      <div
        className={cn('flex items-center justify-center rounded-full mb-4', sz.iconBox, toneClass)}
        aria-hidden
      >
        <Icon className={sz.iconSize} />
      </div>

      <h3 className={cn('font-semibold text-foreground leading-tight', sz.title)}>{title ?? cfg.title}</h3>

      <p className={cn('text-muted-foreground leading-relaxed mt-1.5', sz.desc)}>{description ?? cfg.description}</p>

      {(onRetry || onReport) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {onRetry && (
            <Button onClick={onRetry} size="sm" className="h-9">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Tentar de novo
            </Button>
          )}
          {onReport && (
            <Button onClick={onReport} size="sm" variant="outline" className="h-9">
              <MailQuestion className="h-4 w-4 mr-1.5" />
              Reportar problema
            </Button>
          )}
        </div>
      )}

      {errorId && (
        <p className="mt-4 text-[11px] text-muted-foreground/70 font-mono select-all">ID: {errorId}</p>
      )}
    </div>
  );
}
