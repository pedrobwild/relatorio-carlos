/**
 * Barra de filtros + toggle de visão + botão "Nova Solicitação" do Calendário
 * de Compras.
 *
 * Sticky com `top-0 z-20 bg-card/95 backdrop-blur-sm` para permanecer visível
 * ao rolar listas longas. Os filtros aplicam-se a TODAS as views (lista,
 * calendário) — quem persiste é o consumidor.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CalendarIcon, FilterX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CALENDAR_STATUS_OPTIONS, calendarStatusConfig } from './types';

type ViewMode = 'list' | 'calendar';

interface CalendarioComprasFiltersProps {
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterProject: string;
  setFilterProject: (v: string) => void;
  filterSupplier: string;
  setFilterSupplier: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterActualCost: 'all' | 'informed' | 'pending';
  setFilterActualCost: (v: 'all' | 'informed' | 'pending') => void;
  dateFrom: Date | undefined;
  setDateFrom: (d: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (d: Date | undefined) => void;
  projects: { id: string; name: string }[];
  suppliers: string[];
  categories: string[];
  activeFilterCount: number;
  clearFilters: () => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onNew: () => void;
}

export function CalendarioComprasFilters(p: CalendarioComprasFiltersProps) {
  return (
    <Card className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {[
            { label: 'De', val: p.dateFrom, set: p.setDateFrom, placeholder: 'Início' },
            { label: 'Até', val: p.dateTo, set: p.setDateTo, placeholder: 'Fim' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('w-36 justify-start text-left font-normal', !val && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {val ? format(val, 'dd/MM/yyyy') : placeholder}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={val}
                    onSelect={set as (d: Date | undefined) => void}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    disabled={label === 'Até' && p.dateFrom ? (d) => d < p.dateFrom! : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={p.filterStatus} onValueChange={p.setFilterStatus}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {CALENDAR_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{calendarStatusConfig[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Obra</Label>
            <Select value={p.filterProject} onValueChange={p.setFilterProject}>
              <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Obra" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {p.projects.map((proj) => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Fornecedor</Label>
            <Select value={p.filterSupplier} onValueChange={p.setFilterSupplier}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {p.suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={p.filterCategory} onValueChange={p.setFilterCategory}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {p.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Custo Real</Label>
            <Select value={p.filterActualCost} onValueChange={(v) => p.setFilterActualCost(v as 'all' | 'informed' | 'pending')}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="informed">Informado</SelectItem>
                <SelectItem value="pending">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {p.activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={p.clearFilters} className="h-9 text-muted-foreground">
              <FilterX className="h-3.5 w-3.5 mr-1" />
              Limpar ({p.activeFilterCount})
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2 self-end">
            <div className="flex gap-1">
              <Button
                variant={p.viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => p.setViewMode('list')}
              >
                Lista
              </Button>
              <Button
                variant={p.viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => p.setViewMode('calendar')}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendário
              </Button>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={p.onNew}>
              <Plus className="h-4 w-4" />
              Nova Solicitação
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
