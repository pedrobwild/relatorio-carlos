import { useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Download, Plus, LayoutGrid, List, Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PortfolioPreset, ViewMode, ScopeFilter } from './hooks/usePortfolioFilters';

export type { PortfolioPreset, ViewMode, ScopeFilter };

const presets: { key: PortfolioPreset; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'mine', label: 'Minhas' },
  { key: 'critical', label: 'Críticas' },
  { key: 'stale', label: 'Sem update' },
  { key: 'due-soon', label: 'Vencendo' },
];

interface PortfolioCommandBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activePreset: PortfolioPreset;
  onPresetChange: (preset: PortfolioPreset) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  scopeFilter: ScopeFilter;
  onScopeChange: (scope: ScopeFilter) => void;
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function PortfolioCommandBar({
  search, onSearchChange, activePreset, onPresetChange,
  viewMode, onViewModeChange, totalCount, filteredCount,
  activeFilterCount, onOpenFilters,
}: PortfolioCommandBarProps) {
  const navigate = useNavigate();
  const showingSubset = filteredCount < totalCount;

  return (
    <div className="space-y-2">
      {/* Row 1: Title + View toggle + Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-foreground whitespace-nowrap sm:text-lg">
            Command Center
          </h1>
          <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums shrink-0">
            {showingSubset ? `${filteredCount}/${totalCount}` : totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View toggle */}
          <div className="hidden md:flex items-center rounded-md border border-border/40 bg-muted/20 p-0.5" role="radiogroup" aria-label="Modo de visualização">
            {([
              { mode: 'cards' as ViewMode, icon: LayoutGrid, label: 'Cards' },
              { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
              { mode: 'table' as ViewMode, icon: Table2, label: 'Tabela' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={viewMode === mode}
                aria-label={`Visualização: ${label}`}
                className={cn(
                  'inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground/60 hover:text-foreground'
                )}
                onClick={() => onViewModeChange(mode)}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            variant={activeFilterCount > 0 ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 gap-1 text-[11px] px-2', activeFilterCount > 0 && 'shadow-sm')}
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-3.5 min-w-[14px] px-1 text-[8px] font-bold bg-primary-foreground/20 text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] px-2">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button size="sm" className="h-7 gap-1 text-[11px] font-semibold px-2.5" onClick={() => navigate('/gestao/nova-obra')}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Row 2: Search + Preset pills */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar obra, cliente…"
            className="pl-8 h-7 bg-muted/10 border-border/30 text-xs placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/30"
          />
        </div>

        <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Presets de visualização">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activePreset === key}
              onClick={() => onPresetChange(key)}
              className={cn(
                'whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                activePreset === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                {presets.find(p => p.key === activePreset)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {presets.map(({ key, label }) => (
                <DropdownMenuItem key={key} onClick={() => onPresetChange(key)}>
                  <span className="font-medium text-sm">{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
