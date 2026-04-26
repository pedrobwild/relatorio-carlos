/**
 * Toolbar sticky com busca, selects de filtro e chips removíveis.
 *
 * Os chips ficam abaixo dos selects e exibem apenas filtros ativos —
 * cada chip remove o filtro respectivo ao clicar no X.
 */
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ETAPA_OPTIONS,
  RELACIONAMENTO_OPTIONS,
  STATUS_OPTIONS,
} from '@/hooks/usePainelObras';
import { ALL, NONE, type PainelFilterState, statusDotClass } from './types';

interface PainelFiltersProps {
  state: PainelFilterState;
  set: <K extends keyof PainelFilterState>(key: K, value: PainelFilterState[K]) => void;
  onClear: () => void;
  hasFilters: boolean;
  resultCount: number;
  totalCount: number;
}

export function PainelFilters({
  state,
  set,
  onClear,
  hasFilters,
  resultCount,
  totalCount,
}: PainelFiltersProps) {
  return (
    <div className="sticky top-0 z-30 -mx-2 px-2 py-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border-subtle">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={state.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Buscar obra, cliente ou responsável…"
            className="h-8 pl-8 text-sm bg-surface border-border-subtle"
          />
        </div>

        <Select value={state.filterStatus} onValueChange={(v) => set('filterStatus', v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs border-border-subtle bg-surface">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos status</SelectItem>
            <SelectItem value={NONE}>(sem status)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />
                  {s}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state.filterEtapa} onValueChange={(v) => set('filterEtapa', v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs border-border-subtle bg-surface">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas etapas</SelectItem>
            <SelectItem value={NONE}>(sem etapa)</SelectItem>
            {ETAPA_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.filterRelacionamento}
          onValueChange={(v) => set('filterRelacionamento', v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs border-border-subtle bg-surface">
            <SelectValue placeholder="Relacionamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos relacionamentos</SelectItem>
            <SelectItem value={NONE}>(sem relacionamento)</SelectItem>
            {RELACIONAMENTO_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{resultCount}</span>
          <span className="opacity-60"> / {totalCount} obras</span>
        </span>
      </div>

      <FilterChipsRow state={state} set={set} />
    </div>
  );
}

interface ChipsProps {
  state: PainelFilterState;
  set: <K extends keyof PainelFilterState>(key: K, value: PainelFilterState[K]) => void;
}

function FilterChipsRow({ state, set }: ChipsProps) {
  const chips: { key: keyof PainelFilterState; label: string; reset: PainelFilterState[keyof PainelFilterState] }[] = [];
  if (state.search.trim()) {
    chips.push({ key: 'search', label: `Busca: "${state.search.trim()}"`, reset: '' });
  }
  if (state.filterStatus !== ALL) {
    chips.push({
      key: 'filterStatus',
      label: `Status: ${state.filterStatus === NONE ? '(sem status)' : state.filterStatus}`,
      reset: ALL,
    });
  }
  if (state.filterEtapa !== ALL) {
    chips.push({
      key: 'filterEtapa',
      label: `Etapa: ${state.filterEtapa === NONE ? '(sem etapa)' : state.filterEtapa}`,
      reset: ALL,
    });
  }
  if (state.filterRelacionamento !== ALL) {
    chips.push({
      key: 'filterRelacionamento',
      label: `Relacionamento: ${state.filterRelacionamento === NONE ? '(sem)' : state.filterRelacionamento}`,
      reset: ALL,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
          onClick={() => set(c.key, c.reset as never)}
        >
          {c.label}
          <X className="h-3 w-3 opacity-70" />
        </button>
      ))}
    </div>
  );
}
