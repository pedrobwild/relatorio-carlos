/**
 * Indicador da soma dos pesos das atividades do cronograma.
 *
 * Regras de tom (issue #21):
 *   - Verde   (success):  100% (±0.05)
 *   - Amarelo (warning):  95–99.99% ou 100.05–105%
 *   - Vermelho (danger):  fora dessa faixa (subponderado < 95% ou sobreponderado > 105%)
 *
 * `getWeightTone` é exportado puro para teste. O componente em si fica
 * focado em layout + tooltip explicativo.
 */
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WeightTone = 'success' | 'warning' | 'danger';

const TARGET = 100;
const EXACT_TOLERANCE = 0.05;
const WARNING_BAND = 5; // ±5% da meta gera amarelo

export function getWeightTone(total: number): WeightTone {
  const diff = Math.abs(total - TARGET);
  if (diff <= EXACT_TOLERANCE) return 'success';
  if (diff <= WARNING_BAND) return 'warning';
  return 'danger';
}

const TONE_CLASS: Record<WeightTone, { bar: string; text: string }> = {
  success: { bar: '[&>div]:bg-[hsl(var(--success))]', text: 'text-[hsl(var(--success))]' },
  warning: { bar: '[&>div]:bg-[hsl(var(--warning))]', text: 'text-[hsl(var(--warning))]' },
  danger: { bar: '[&>div]:bg-destructive', text: 'text-destructive' },
};

const TOOLTIP_TEXT =
  'A soma dos pesos das atividades deve totalizar 100%. ' +
  'Verde: 100%. Amarelo: até ±5% da meta (95-105%). Vermelho: fora dessa faixa.';

interface WeightProgressProps {
  total: number;
  className?: string;
}

export function WeightProgress({ total, className }: WeightProgressProps) {
  const tone = getWeightTone(total);
  const classes = TONE_CLASS[tone];

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/40 border border-border/60',
          className,
        )}
      >
        <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          Peso total
        </span>
        <Progress
          value={Math.min(total, 100)}
          className={cn('h-2 flex-1 rounded-full max-w-xs', classes.bar)}
        />
        <span
          className={cn(
            'text-sm font-bold tabular-nums whitespace-nowrap min-w-[52px] text-right',
            classes.text,
          )}
        >
          {total.toFixed(1)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Como funciona o peso total"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
