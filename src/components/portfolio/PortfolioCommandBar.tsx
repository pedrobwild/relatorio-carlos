import { useNavigate } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  Download,
  Plus,
  LayoutGrid,
  List,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  PortfolioPreset,
  ViewMode,
  ScopeFilter,
} from "./hooks/usePortfolioFilters";

export type { PortfolioPreset, ViewMode, ScopeFilter };

const presets: { key: PortfolioPreset; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "mine", label: "Minhas" },
  { key: "critical", label: "Críticas" },
  { key: "stale", label: "Sem update" },
  { key: "due-soon", label: "Vencendo" },
  { key: "completed", label: "Concluídas" },
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
  engineers: { id: string; name: string }[];
  selectedEngineer: string | null;
  onEngineerChange: (engineerId: string | null) => void;
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
  onExport?: () => void;
}

export function PortfolioCommandBar({
  search,
  onSearchChange,
  activePreset,
  onPresetChange,
  viewMode,
  onViewModeChange,
  scopeFilter,
  onScopeChange,
  engineers,
  selectedEngineer,
  onEngineerChange,
  totalCount,
  filteredCount,
  activeFilterCount,
  onOpenFilters,
  onExport,
}: PortfolioCommandBarProps) {
  const navigate = useNavigate();
  const showingSubset = filteredCount < totalCount;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-2">
        {/* Row 1: Title + Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap sm:text-xl">
              Portfólio de Obras
            </h1>
            {showingSubset && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 h-5 shrink-0 tabular-nums"
              >
                {filteredCount}/{totalCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View toggle — desktop only */}
            <div
              className="hidden md:flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5"
              role="radiogroup"
              aria-label="Modo de visualização"
            >
              {[
                {
                  mode: "cards" as ViewMode,
                  icon: LayoutGrid,
                  label: "Cards",
                  description: "Visão geral",
                },
                {
                  mode: "list" as ViewMode,
                  icon: List,
                  label: "Lista",
                  description: "Resumo rápido",
                },
              ].map(({ mode, icon: Icon, label, description }) => (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <button
                      role="radio"
                      aria-checked={viewMode === mode}
                      aria-label={`Visualização: ${label} — ${description}`}
                      className={cn(
                        "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        viewMode === mode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => onViewModeChange(mode)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground">{description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Button
              variant={activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs px-2.5 rounded-lg",
                activeFilterCount > 0 && "shadow-sm",
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
              className="h-8 gap-1.5 text-xs px-2.5 rounded-lg hidden sm:flex"
              onClick={onExport}
              disabled={!onExport}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Exportar</span>
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold px-3 rounded-lg bg-gradient-to-r from-primary to-[hsl(var(--primary-dark))] hover:opacity-90 shadow-sm hidden sm:flex"
              onClick={() => navigate("/gestao/nova-obra")}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Nova Obra</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Search — full width on mobile, with scope toggle on desktop */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar obra, cliente…"
              className="pl-9 h-10 md:h-9 bg-card border-border/50 text-sm rounded-xl md:rounded-lg placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40"
            />
          </div>

          {/* Engineer filter */}
          {engineers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={selectedEngineer ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 md:h-9 gap-1.5 text-xs px-2.5 rounded-lg shrink-0 whitespace-nowrap",
                    selectedEngineer && "shadow-sm",
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {selectedEngineer
                      ? (engineers
                          .find((e) => e.id === selectedEngineer)
                          ?.name?.split(" ")[0] ?? "Responsável")
                      : "Responsável"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 overflow-y-auto"
              >
                {selectedEngineer && (
                  <DropdownMenuItem onClick={() => onEngineerChange(null)}>
                    Todos os responsáveis
                  </DropdownMenuItem>
                )}
                {engineers.map((eng) => (
                  <DropdownMenuItem
                    key={eng.id}
                    onClick={() =>
                      onEngineerChange(
                        eng.id === selectedEngineer ? null : eng.id,
                      )
                    }
                    className={cn(
                      selectedEngineer === eng.id &&
                        "bg-primary/10 font-semibold",
                    )}
                  >
                    {eng.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Scope toggle — desktop only */}
          <div
            className="hidden md:flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5 shrink-0"
            role="radiogroup"
            aria-label="Escopo"
          >
            {[
              { key: "all" as ScopeFilter, label: "Tudo" },
              { key: "obras" as ScopeFilter, label: "Obras" },
              { key: "projetos" as ScopeFilter, label: "Projetos" },
            ].map(({ key, label }) => (
              <button
                key={key}
                role="radio"
                aria-checked={scopeFilter === key}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  scopeFilter === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onScopeChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Preset pills — scrollable on mobile */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5 md:mx-0 md:px-0"
          role="tablist"
          aria-label="Presets de visualização"
        >
          {presets.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activePreset === key}
              onClick={() => onPresetChange(key)}
              className={cn(
                "whitespace-nowrap px-3.5 py-2 md:py-1.5 rounded-full text-xs font-semibold transition-all shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "min-h-[36px] md:min-h-0",
                activePreset === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
