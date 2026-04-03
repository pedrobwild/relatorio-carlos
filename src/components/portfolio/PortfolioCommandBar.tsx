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
import type { PortfolioPreset, ViewMode } from './hooks/usePortfolioFilters';

export type { PortfolioPreset, ViewMode };

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
  search, onSearchChange, activePreset, onPresetChange,
  viewMode, onViewModeChange, totalCount, filteredCount,
  activeFilterCount, onOpenFilters,
}: PortfolioCommandBarProps) {
  const navigate = useNavigate();
  const showingSubset = filteredCount < totalCount;

  return (
    <div className="space-y-3">
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap sm:text-xl">
            Command Center
          </h1>
          <Badge variant="secondary" className="tabular-nums text-[11px] font-semibold bg-muted text-muted-foreground shrink-0">
            {showingSubset ? `${filteredCount} / ${totalCount}` : totalCount} obras
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* View toggle */}
          <div className="hidden md:flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5" role="radiogroup" aria-label="Modo de visualização">
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
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onViewModeChange(mode)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            variant={activeFilterCount > 0 ? 'default' : 'outline'}
            size="sm"
            className={cn('h-8 gap-1.5 text-xs', activeFilterCount > 0 && 'shadow-sm')}
            onClick={onOpenFilters}
            aria-label={activeFilterCount > 0 ? `Filtros (${activeFilterCount} ativos)` : 'Abrir filtros'}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[9px] font-bold bg-primary-foreground/20 text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" aria-label="Exportar dados">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={() => navigate('/gestao/nova-obra')}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Nova Obra</span>
          </Button>
        </div>
      </div>

      {/* Row 2: Search + Preset pills */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar obra, cliente, unidade ou endereço…"
            className="pl-10 h-9 bg-muted/20 border-border/50 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
            aria-label="Busca global de obras"
          />
        </div>

        <nav className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Presets de visualização">
          {presets.map(({ key, label, description }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activePreset === key}
              title={description}
              onClick={() => onPresetChange(key)}
              className={cn(
                'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                activePreset === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                {presets.find(p => p.key === activePreset)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {presets.map(({ key, label, description }) => (
                <DropdownMenuItem key={key} onClick={() => onPresetChange(key)} className="flex flex-col items-start gap-0.5">
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
