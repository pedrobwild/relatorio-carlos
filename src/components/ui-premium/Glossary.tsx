import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { glossario, type GlossaryKey } from '@/content/glossario';

export interface GlossaryProps {
  /** Chave do termo em `src/content/glossario.ts`. */
  termKey: GlossaryKey;
  /** Override do label exibido (default: `glossario[termKey].term`). */
  children?: React.ReactNode;
  /** Esconde o ícone de info (mantém só o sublinhado pontilhado). */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Marca um termo técnico de obra com tooltip acessível explicando-o
 * em linguagem leiga. Acessível por mouse, teclado (focus) e screen
 * reader (`aria-describedby` injetado pelo Radix).
 *
 * Uso:
 * ```tsx
 * <Glossary termKey="medicao" />
 * <Glossary termKey="rdo">RDO de hoje</Glossary>
 * ```
 */
export function Glossary({
  termKey,
  children,
  hideIcon,
  className,
}: GlossaryProps) {
  const entry = glossario[termKey];

  if (!entry) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Glossary] termo desconhecido: "${termKey}"`);
    }
    return <span className={className}>{children ?? termKey}</span>;
  }

  const label = children ?? entry.term;
  const tooltipId = `glossary-${String(termKey)}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${entry.term}: ${entry.definition}`}
            className={cn(
              'inline-flex items-center gap-1 align-baseline',
              'border-b border-dotted border-muted-foreground/60',
              'cursor-help select-text bg-transparent p-0 text-inherit',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm',
              className,
            )}
          >
            <span>{label}</span>
            {!hideIcon && (
              <Info
                className="h-3 w-3 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          id={tooltipId}
          side="top"
          align="start"
          className="max-w-xs text-xs leading-relaxed"
        >
          <p className="font-semibold mb-1">{entry.term}</p>
          <p className="text-popover-foreground/90">{entry.definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default Glossary;
