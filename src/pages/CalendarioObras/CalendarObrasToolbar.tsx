/**
 * Toolbar do Calendário de Obras: tabs de view, contagens, navegação de
 * período (prev/next/hoje), date picker, e o controle especial de "range"
 * com aplicar/resetar.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  X,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addMonths, addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { STATUS_BADGE, capitalizeFirst, periodLabel, type ActivityStatusKey, type ViewMode } from './types';

interface Counts extends Record<ActivityStatusKey, number> {
  total: number;
}

interface CalendarObrasToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;

  refDate: Date;
  setRefDate: (d: Date) => void;
  today: Date;

  rangeStartDate: Date;
  rangeEndDate: Date;
  draftRangeStart: Date;
  draftRangeEnd: Date;
  setDraftRangeStart: (d: Date) => void;
  setDraftRangeEnd: (d: Date) => void;
  draftRangeInvalid: boolean;
  draftDirty: boolean;
  applyDraftRange: () => void;
  resetDraftRange: () => void;

  goPrev: () => void;
  goNext: () => void;
  goToday: () => void;

  viewStart: Date;
  viewEnd: Date;
  counts: Counts;
  purchaseCount: number;
}

export function CalendarObrasToolbar(p: CalendarObrasToolbarProps) {
  const labelText = capitalizeFirst(periodLabel(p.view, p.refDate, p.viewStart, p.viewEnd));

  return (
    <Card className="mb-4">
      <CardContent className="py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={p.view} onValueChange={(v) => p.onViewChange(v as ViewMode)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week-list" title="Semana em formato de lista agrupada por obra">Semana · Lista</TabsTrigger>
              <TabsTrigger value="week-timeline" title="Semana em formato de linha do tempo (Gantt)">Semana · Timeline</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="range">Período</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Total: {p.counts.total}</Badge>
            <Badge className={STATUS_BADGE.in_progress.className}>Em andamento: {p.counts.in_progress}</Badge>
            <Badge className={STATUS_BADGE.overdue.className}>Atrasadas: {p.counts.overdue}</Badge>
            <Badge className={STATUS_BADGE.pending.className}>Pendentes: {p.counts.pending}</Badge>
            <Badge className={STATUS_BADGE.completed.className}>Concluídas: {p.counts.completed}</Badge>
            {p.purchaseCount > 0 && (
              <Badge
                className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                title="Solicitações de compra criadas no período visível"
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Compras: {p.purchaseCount}
              </Badge>
            )}
          </div>
        </div>

        {p.view !== 'range' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={p.goPrev} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="font-semibold">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {labelText}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={p.refDate}
                  onSelect={(d) => d && p.setRefDate(d)}
                  initialFocus
                  locale={ptBR}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={p.goNext} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={p.goToday}>Hoje</Button>

            {(p.view === 'month' || p.view === 'week-list' || p.view === 'week-timeline') && (
              <div className="flex items-center gap-1 ml-1 pl-2 border-l">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => p.setRefDate(addWeeks(p.today, 1))}
                  title="Ir para a próxima semana (mantém o filtro de obra)"
                >
                  Próxima semana
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => p.setRefDate(addMonths(p.today, 1))}
                  title="Ir para o próximo mês (mantém o filtro de obra)"
                >
                  Próximo mês
                </Button>
              </div>
            )}
          </div>
        ) : (
          <RangeNavigator p={p} />
        )}
      </CardContent>
    </Card>
  );
}

function RangeNavigator({ p }: { p: CalendarObrasToolbarProps }) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={p.goPrev} aria-label="Período anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(p.draftRangeInvalid && 'border-destructive text-destructive')}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Início: <strong className="ml-1">{format(p.draftRangeStart, 'dd/MM/yyyy')}</strong>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={p.draftRangeStart}
              onSelect={(d) => d && p.setDraftRangeStart(d)}
              initialFocus
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(p.draftRangeInvalid && 'border-destructive text-destructive')}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Fim: <strong className="ml-1">{format(p.draftRangeEnd, 'dd/MM/yyyy')}</strong>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={p.draftRangeEnd}
              onSelect={(d) => d && p.setDraftRangeEnd(d)}
              initialFocus
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          onClick={p.applyDraftRange}
          disabled={p.draftRangeInvalid || !p.draftDirty}
          title={
            p.draftRangeInvalid
              ? 'A data de início deve ser anterior ou igual à data de fim'
              : !p.draftDirty
                ? 'Nenhuma alteração pendente'
                : 'Aplicar período selecionado'
          }
        >
          Aplicar
        </Button>
        {p.draftDirty && (
          <Button variant="ghost" size="sm" onClick={p.resetDraftRange} title="Descartar alterações">
            <X className="h-3.5 w-3.5 mr-1" />
            Resetar
          </Button>
        )}

        <Button variant="outline" size="icon" onClick={p.goNext} aria-label="Próximo período">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={p.goToday}>Hoje</Button>
      </div>

      {p.draftRangeInvalid ? (
        <p className="text-xs text-destructive">A data de início deve ser anterior ou igual à data de fim.</p>
      ) : p.draftDirty ? (
        <p className="text-xs text-muted-foreground">
          Período selecionado ainda não aplicado — clique em <strong>Aplicar</strong> para atualizar a timeline.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Filter className="h-3 w-3" />
          Exibindo {format(p.rangeStartDate, 'dd/MM/yyyy')} → {format(p.rangeEndDate, 'dd/MM/yyyy')} (
          {Math.round((p.rangeEndDate.getTime() - p.rangeStartDate.getTime()) / 86_400_000) + 1} dias).
        </p>
      )}
    </div>
  );
}
