import { useCallback } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useQueryFreshness } from '@/hooks/useQueryFreshness';

interface FreshnessIndicatorProps {
  queryKey: QueryKey;
  /** Threshold in minutes after which the indicator is highlighted as stale. Defaults to 5. */
  staleAfterMinutes?: number;
  /** Optional label prefix. Defaults to "Atualizado". */
  label?: string;
  className?: string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatAge(ageMinutes: number): string {
  if (!Number.isFinite(ageMinutes)) return 'nunca atualizado';
  if (ageMinutes < 1) return 'há instantes';
  if (ageMinutes === 1) return 'há 1 minuto';
  if (ageMinutes < 60) return `há ${ageMinutes} minutos`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours === 1) return 'há 1 hora';
  if (hours < 24) return `há ${hours} horas`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

/**
 * Shows when a query last resolved + a manual refresh button.
 * Use on pages where users need to know the data freshness
 * (e.g. Compras, Pendencias, PainelObras).
 */
export function FreshnessIndicator({
  queryKey,
  staleAfterMinutes = 5,
  label = 'Atualizado',
  className,
}: FreshnessIndicatorProps) {
  const queryClient = useQueryClient();
  const { updatedAt, ageMinutes, isStale, isFetching } = useQueryFreshness(queryKey);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const isVisuallyStale = isStale || ageMinutes >= staleAfterMinutes;
  const display = updatedAt
    ? `${label} às ${formatTime(updatedAt)}`
    : 'Aguardando primeira atualização';
  const tooltipContent = updatedAt
    ? `${label} ${formatAge(ageMinutes)} (${formatTime(updatedAt)})`
    : 'Os dados ainda não foram carregados';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-xs text-muted-foreground',
        isVisuallyStale && 'text-amber-600 dark:text-amber-400',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-live="polite" className="cursor-default">{display}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={refresh}
        disabled={isFetching}
        aria-label="Atualizar dados"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
      </Button>
    </div>
  );
}
