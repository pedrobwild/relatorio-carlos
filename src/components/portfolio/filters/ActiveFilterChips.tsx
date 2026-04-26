import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getActiveFilterChips, removeFilterChip, isFiltersEmpty, emptyFilters, type AdvancedFilters } from './types';
import { PRESET_LABEL, KPI_FILTER_LABEL } from '../portfolioLabels';
import type { PortfolioPreset } from '../hooks/usePortfolioFilters';
import type { KpiFilterKey } from '../PortfolioKpiStrip';

interface ChipDescriptor {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;

  // Optional: simple ("scalar") filters that live alongside AdvancedFilters
  // — shown as chips when set so the user has a single visual surface for
  // every active filter (issue #16: "Chips de filtros ativos com '×'").
  search?: string;
  onSearchClear?: () => void;
  preset?: PortfolioPreset;
  onPresetClear?: () => void;
  kpi?: KpiFilterKey | null;
  onKpiClear?: () => void;
  engineerName?: string | null;
  onEngineerClear?: () => void;

  /** When provided, a "Limpar todos" button clears every chip in one click. */
  onClearAll?: () => void;
  /** Optional results count rendered as the trailing meta ("23 resultados"). */
  resultsCount?: number;
}

/**
 * Horizontal row of active filter chips with per-chip dismiss, plus an
 * optional "Limpar todos" CTA and a trailing results counter.
 *
 * Two layers of filters are merged into a single row:
 *   - Scalar filters (search, preset, kpi, engineer) when their callbacks
 *     are provided.
 *   - The full `AdvancedFilters` object (status, phase, engineers, …).
 *
 * Renders nothing when no filter is active.
 */
export function ActiveFilterChips({
  filters,
  onFiltersChange,
  search,
  onSearchClear,
  preset,
  onPresetClear,
  kpi,
  onKpiClear,
  engineerName,
  onEngineerClear,
  onClearAll,
  resultsCount,
}: ActiveFilterChipsProps) {
  const advancedChips = useMemo(
    () =>
      getActiveFilterChips(filters).map(c => ({
        key: c.key,
        label: c.label,
        onRemove: () => onFiltersChange(removeFilterChip(filters, c.key)),
      })),
    [filters, onFiltersChange],
  );

  const scalarChips: ChipDescriptor[] = [];
  if (search && onSearchClear) {
    scalarChips.push({ key: 'search', label: `Busca: "${truncate(search, 24)}"`, onRemove: onSearchClear });
  }
  if (preset && preset !== 'all' && onPresetClear) {
    scalarChips.push({ key: 'preset', label: PRESET_LABEL[preset], onRemove: onPresetClear });
  }
  if (kpi && onKpiClear) {
    scalarChips.push({ key: 'kpi', label: KPI_FILTER_LABEL[kpi], onRemove: onKpiClear });
  }
  if (engineerName && onEngineerClear) {
    scalarChips.push({ key: 'eng', label: `Eng: ${engineerName}`, onRemove: onEngineerClear });
  }

  const allChips = [...scalarChips, ...advancedChips];
  const advancedActive = !isFiltersEmpty(filters);
  const anyActive = allChips.length > 0 || advancedActive;
  if (!anyActive) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        Filtros:
      </span>

      {allChips.map(chip => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="shrink-0 gap-1 pl-2.5 pr-1 py-0.5 text-xs font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
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
        onClick={onClearAll ?? (() => onFiltersChange(emptyFilters))}
      >
        Limpar todos
      </Button>

      {typeof resultsCount === 'number' && (
        <span
          className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {resultsCount} resultado{resultsCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
