/**
 * Estado de filtros + ordenação + busca do Painel de Obras.
 *
 * Centraliza tudo num único hook para que `index.tsx` permaneça enxuto e
 * para que o resultado filtrado seja memoizado em um lugar só (evitar
 * recompute em cascata nas sub-views).
 */
import { useCallback, useMemo, useState } from 'react';
import type { PainelObra } from '@/hooks/usePainelObras';
import {
  ALL,
  computeDisplayStatus,
  EMPTY_FILTERS,
  NONE,
  isCritical,
  isThisMonth,
  type PainelFilterState,
  type SortKey,
  type SortDirection,
} from './types';

interface UsePainelFiltersArgs {
  obras: PainelObra[];
  /** Predicado opcional aplicado depois dos filtros (saved views builtin como "Críticas"). */
  scope?: 'all' | 'critical' | 'this-month-delivery' | 'awaiting-customer';
}

export function usePainelFilters({ obras, scope = 'all' }: UsePainelFiltersArgs) {
  const [state, setState] = useState<PainelFilterState>({ ...EMPTY_FILTERS });

  const setFromView = useCallback((next: PainelFilterState) => {
    setState({ ...next });
  }, []);

  const set = useCallback(
    <K extends keyof PainelFilterState>(key: K, value: PainelFilterState[K]) =>
      setState((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const clearFilters = useCallback(
    () =>
      setState((prev) => ({
        ...prev,
        search: '',
        filterEtapa: ALL,
        filterStatus: ALL,
        filterRelacionamento: ALL,
      })),
    [],
  );

  const toggleSort = useCallback((key: NonNullable<SortKey>) => {
    setState((prev) => {
      if (prev.sortKey === key) {
        const dir: SortDirection = prev.sortDir === 'asc' ? 'desc' : 'asc';
        return { ...prev, sortDir: dir };
      }
      return { ...prev, sortKey: key, sortDir: 'asc' };
    });
  }, []);

  const filtered = useMemo(() => {
    let rows = obras;

    if (scope === 'critical') {
      rows = rows.filter(isCritical);
    } else if (scope === 'this-month-delivery') {
      rows = rows.filter((o) => isThisMonth(o.entrega_oficial));
    } else if (scope === 'awaiting-customer') {
      rows = rows.filter((o) => computeDisplayStatus(o) === 'Aguardando');
    }

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      rows = rows.filter(
        (o) =>
          o.nome.toLowerCase().includes(q) ||
          (o.customer_name ?? '').toLowerCase().includes(q) ||
          (o.engineer_name ?? '').toLowerCase().includes(q),
      );
    }
    if (state.filterEtapa !== ALL) {
      rows = rows.filter((o) =>
        state.filterEtapa === NONE ? !o.etapa : o.etapa === state.filterEtapa,
      );
    }
    if (state.filterStatus !== ALL) {
      rows = rows.filter((o) => {
        const display = computeDisplayStatus(o);
        return state.filterStatus === NONE ? !display : display === state.filterStatus;
      });
    }
    if (state.filterRelacionamento !== ALL) {
      rows = rows.filter((o) =>
        state.filterRelacionamento === NONE
          ? !o.relacionamento
          : o.relacionamento === state.filterRelacionamento,
      );
    }
    if (state.sortKey) {
      const key = state.sortKey;
      const dir = state.sortDir;
      rows = [...rows].sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [obras, scope, state]);

  const hasFilters =
    !!state.search.trim() ||
    state.filterEtapa !== ALL ||
    state.filterStatus !== ALL ||
    state.filterRelacionamento !== ALL;

  return {
    state,
    set,
    setFromView,
    clearFilters,
    toggleSort,
    filtered,
    hasFilters,
  };
}

export type PainelFiltersApi = ReturnType<typeof usePainelFilters>;
