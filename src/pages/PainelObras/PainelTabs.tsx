/**
 * Tabs no topo do Painel — combinam presets builtin e saved views custom.
 *
 * Cada tab aplica seu `filters` ao hook `usePainelFilters` quando ativada.
 * O botão "+ Nova view" abre um prompt simples para nomear a view a partir
 * do estado atual de filtros (mantém o overhead leve sem dialog cheio).
 *
 * Views custom recebem um botão remover (ícone X) ao lado do nome.
 */
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PainelFilterState, SavedView } from './types';

interface PainelTabsProps {
  views: SavedView[];
  activeViewId: string;
  onSelectView: (view: SavedView) => void;
  onRemoveView: (id: string) => void;
  onCreateView: (name: string) => void;
  /** Estado de filtros atual — usado para indicar mudança não-salva. */
  currentFilters: PainelFilterState;
}

export function PainelTabs({
  views,
  activeViewId,
  onSelectView,
  onRemoveView,
  onCreateView,
  currentFilters,
}: PainelTabsProps) {
  const handleCreate = () => {
    const name = window.prompt('Nome da nova view (ex: "Atrasadas + Crítico"):');
    if (!name?.trim()) return;
    onCreateView(name.trim());
  };

  return (
    <div className="flex items-center gap-1 flex-wrap border-b border-border-subtle pb-1">
      {views.map((view) => {
        const isActive = view.id === activeViewId;
        const isCustom = !view.builtin;
        const isDirty =
          isActive && JSON.stringify(view.filters) !== JSON.stringify(currentFilters);
        return (
          <div
            key={view.id}
            className={cn(
              'group inline-flex items-center rounded-md text-xs transition-colors',
              isActive
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-accent/40 border border-transparent',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectView(view)}
              className="px-2.5 h-7 inline-flex items-center gap-1.5 font-medium"
            >
              {view.name}
              {isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="Filtros modificados" />
              )}
            </button>
            {isCustom && (
              <button
                type="button"
                onClick={() => onRemoveView(view.id)}
                aria-label={`Remover view ${view.name}`}
                className="px-1.5 h-7 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        onClick={handleCreate}
      >
        <Plus className="h-3 w-3" />
        Nova view
      </Button>
    </div>
  );
}
