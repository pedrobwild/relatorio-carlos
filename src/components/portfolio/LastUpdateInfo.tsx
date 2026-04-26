import { Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatBR, formatRelativeTime } from '@/lib/dates';

interface LastUpdateInfoProps {
  /** ISO timestamp from the database (e.g. `summary.last_activity_at`). */
  value: string | null | undefined;
  /** Inline by default; set to `block` for stacked card footers. */
  display?: 'inline' | 'block';
  /** Hide the leading clock glyph (useful inside dense tables). */
  hideIcon?: boolean;
  /** Copy used when the project has never been touched. */
  emptyLabel?: string;
  /** Tooltip prefix above the absolute date. */
  tooltipPrefix?: string;
  className?: string;
}

/**
 * Renders "última atualização" using the centralized relative-time format
 * (`há 3 dias`) with a tooltip exposing the absolute São Paulo timestamp.
 *
 * Uses `lib/dates#formatRelativeTime` and `lib/dates#formatBR` so all
 * surfaces (cards, drawer, list view) agree on copy and timezone.
 */
export function LastUpdateInfo({
  value,
  display = 'inline',
  hideIcon = false,
  emptyLabel = 'Sem registro',
  tooltipPrefix = 'Última atividade em',
  className,
}: LastUpdateInfoProps) {
  const hasValue = Boolean(value);
  const relative = hasValue ? formatRelativeTime(value, emptyLabel) : emptyLabel;
  const absolute = hasValue ? formatBR(value, "dd/MM/yyyy 'às' HH:mm") : null;

  const content = (
    <span
      className={cn(
        'items-center gap-1.5 text-xs text-muted-foreground',
        display === 'inline' ? 'inline-flex' : 'flex',
        className,
      )}
    >
      {!hideIcon && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate">{relative}</span>
    </span>
  );

  if (!absolute) return content;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipPrefix} {absolute}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
