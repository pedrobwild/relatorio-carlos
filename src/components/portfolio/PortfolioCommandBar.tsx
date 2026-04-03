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

export type PortfolioPreset =
  | 'all'
  | 'mine'
  | 'critical'
  | 'stale'
  | 'due-soon';

export type ViewMode = 'cards' | 'list' | 'table';

const presets: { key: PortfolioPreset; label: string; description: string }[] = [
  { key: 'all', label: 'Todas as obras', description: 'Visão completa do portfólio' },
  { key: 'mine', label: 'Minhas obras', description: 'Obras atribuídas a mim' },
  { key: 'critical', label: 'Obras críticas', description: 'Saúde baixa ou em atraso' },
  { key: 'stale', label: 'Sem atualização', description: 'Sem atividade recente' },
  { key: 'due-soon', label: 'Vencendo em breve', description: 'Prazo nos próximos 7 dias' },
];

interface PortfolioCommandBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activePreset: PortfolioPreset;
  onPresetChange: (preset: PortfolioPreset) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function PortfolioCommandBar({
  search,
  onSearchChange,
  activePreset,
  onPresetChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  activeFilterCount,
  onOpenFilters,
}: PortfolioCommandBarProps) {
  const navigate = useNavigate();

  const hasActiveFilters = activeFilterCount > 0 || search.length > 0 || activePreset !== 'all';
  const showingSubset = filteredCount < totalCount;

  return (
    <div className="space-y-3">
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
            Command Center
          </h1>
          <Badge
            variant="secondary"
            className="tabular-nums text-xs font-semibold bg-muted text-muted-foreground"
          >
            {showingSubset ? `${filteredCount} de ${totalCount}` : `${totalCount}`} obras
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="hidden md:flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            {([
              { mode: 'cards' as ViewMode, icon: LayoutGrid, label: 'Cards' },
              { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
              { mode: 'table' as ViewMode, icon: Table2, label: 'Tabela' },
            ]).map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2.5 rounded-md text-xs gap-1.5 transition-all',
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onViewModeChange(mode)}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{label}</span>
              </Button>
            ))}
          </div>

          {/* Filters button */}
          <Button
            variant={activeFilterCount > 0 ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs relative',
              activeFilterCount > 0 && 'shadow-sm'
            )}
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-[16px] px-1 text-[9px] font-bold bg-primary-foreground/20 text-primary-foreground"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
            onClick={() => navigate('/gestao/nova-obra')}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Obra
          </Button>
        </div>
      </div>

      {/* Row 2: Search + Preset pills */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar obra, cliente, unidade ou endereço…"
            className="pl-10 h-9 bg-muted/30 border-border/60 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
          />
        </div>

        {/* Preset pills */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onPresetChange(key)}
              className={cn(
                'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activePreset === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile preset dropdown */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                {presets.find(p => p.key === activePreset)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {presets.map(({ key, label, description }) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onPresetChange(key)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
