import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getActiveFilterChips,
  removeFilterChip,
  isFiltersEmpty,
  emptyFilters,
  type AdvancedFilters,
} from "./types";

interface ActiveFilterChipsProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
}

/**
 * Horizontal row of active filter chips with individual dismiss.
 * Renders nothing if no filters are active.
 */
export function ActiveFilterChips({
  filters,
  onFiltersChange,
}: ActiveFilterChipsProps) {
  if (isFiltersEmpty(filters)) return null;

  const chips = getActiveFilterChips(filters);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        Filtros:
      </span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="shrink-0 gap-1 pl-2.5 pr-1 py-0.5 text-xs font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onFiltersChange(removeFilterChip(filters, chip.key))}
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Remover filtro ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 h-6 text-[11px] text-destructive px-2"
        onClick={() => onFiltersChange(emptyFilters)}
      >
        Limpar todos
      </Button>
    </div>
  );
}
