/**
 * Estado e helpers de seleção em massa no Painel de Obras.
 *
 * - mantém um `Set<string>` de IDs selecionados
 * - garante que IDs não-mais-presentes (após filtro) somem da seleção
 * - expõe utilitários toggle/all/none/has
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePainelSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Limpa seleções de IDs que sumiram da view (filtro mudou).
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(visibleIds);
      let mutated = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else mutated = true;
      });
      return mutated ? next : prev;
    });
  }, [visibleIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selected.has(id)),
    [visibleIds, selected],
  );

  const hasAny = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) clear();
    else setAll(visibleIds);
  }, [allSelected, clear, setAll, visibleIds]);

  return {
    selected,
    selectedIds: useMemo(() => Array.from(selected), [selected]),
    selectedCount: selected.size,
    hasAny,
    allSelected,
    has: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
  };
}
