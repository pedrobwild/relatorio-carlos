/**
 * Side panel de detalhe da obra — substitui a expansão inline do `ObraExpandedRow`
 * por um `<Sheet>` que preserva o scroll da tabela.
 *
 * Mostra o `DailyLogInline` (registros diários da obra) + atalho para abrir
 * a página completa da obra. Largura `lg:w-[640px]` conforme spec da issue.
 */
import { ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DailyLogInline } from '@/components/admin/obras/DailyLogInline';
import { cn } from '@/lib/utils';
import type { PainelObra } from '@/hooks/usePainelObras';
import { computeDisplayStatus, statusDotClass, statusPillClass } from './types';

interface PainelDetailSheetProps {
  obra: PainelObra | null;
  onOpenChange: (open: boolean) => void;
  onOpenObra: (obraId: string) => void;
}

export function PainelDetailSheet({ obra, onOpenChange, onOpenObra }: PainelDetailSheetProps) {
  const open = !!obra;
  const display = obra ? computeDisplayStatus(obra) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-none lg:w-[640px] p-0 flex flex-col"
      >
        {obra && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border-subtle space-y-2">
              <SheetTitle className="text-base">
                {obra.customer_name ? `${obra.customer_name} — ` : ''}
                {obra.nome}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium',
                    statusPillClass(display),
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(display))} />
                  {display ?? 'Sem status'}
                </span>
                {obra.etapa && (
                  <span className="text-xs text-muted-foreground">{obra.etapa}</span>
                )}
                {obra.engineer_name && (
                  <span className="text-xs text-muted-foreground">
                    · Resp.: {obra.engineer_name}
                  </span>
                )}
              </SheetDescription>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => onOpenObra(obra.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir página da obra
                </Button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <DailyLogInline projectId={obra.id} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
