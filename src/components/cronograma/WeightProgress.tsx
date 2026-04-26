/**
 * WeightProgress — visual validator that the cronograma's activity weights
 * sum to 100%. Sits in the Cronograma toolbar.
 *
 * Tone:
 *  - success when total = 100% (±0.5 to absorb float rounding)
 *  - warning when within ±5 (almost there, but inconsistent)
 *  - danger when off by more than ±5 (will break Curva S)
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/ui-premium';
import { cn } from '@/lib/utils';
import { getWeightTotalInfo } from '@/lib/scheduleState';

interface WeightProgressProps {
  weights: number[];
  className?: string;
}

const BAR_TONE: Record<'ok' | 'close' | 'off', string> = {
  ok: 'bg-success',
  close: 'bg-warning',
  off: 'bg-destructive',
};

export function WeightProgress({ weights, className }: WeightProgressProps) {
  const info = getWeightTotalInfo(weights);
  const fillPercent = Math.min(100, Math.max(0, info.total));

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn('flex items-center gap-2', className)}
            role="status"
            aria-label={info.message}
          >
            <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full transition-all', BAR_TONE[info.state])}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <StatusBadge tone={info.tone} size="sm">
              {info.total.toFixed(1)}%
            </StatusBadge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{info.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            A soma dos pesos das atividades deve fechar 100% para a Curva S
            ficar consistente.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
