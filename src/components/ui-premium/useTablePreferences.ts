/**
 * useTablePreferences — persiste preferências visuais do DataTable.
 *
 * Persiste em localStorage:
 *  - visibleColumnIds: ordem e visibilidade das colunas
 *  - zebra: zebra striping ligado/desligado
 *  - density: densidade da tabela
 *
 * Garante colunas `required` sempre visíveis e ignora ids obsoletos.
 *
 * @example
 * const prefs = useTablePreferences('painel-obras', columns, {
 *   defaultVisibleIds: ['name', 'status', 'progress'],
 *   defaultZebra: false,
 *   defaultDensity: 'comfortable',
 * });
 *
 * <DataTable
 *   columns={columns}
 *   visibleColumnIds={prefs.visibleColumnIds}
 *   zebra={prefs.zebra}
 *   density={prefs.density}
 *   ...
 * />
 * <DataTableSettings prefs={prefs} columns={columns} />
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataTableColumn, TableDensity } from "./DataTable";

const STORAGE_PREFIX = "lov.table-prefs.v1";

export interface TablePreferencesState {
  visibleColumnIds: string[];
  zebra: boolean;
  density: TableDensity;
}

export interface UseTablePreferencesOptions {
  defaultVisibleIds?: string[];
  defaultZebra?: boolean;
  defaultDensity?: TableDensity;
}

export interface UseTablePreferencesReturn extends TablePreferencesState {
  setZebra: (value: boolean) => void;
  toggleZebra: () => void;
  setDensity: (value: TableDensity) => void;
  setVisibleColumnIds: (ids: string[]) => void;
  toggleColumn: (id: string) => void;
  reset: () => void;
}

function readStorage(key: string): Partial<TablePreferencesState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<TablePreferencesState>;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: TablePreferencesState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useTablePreferences<T>(
  storageKey: string,
  columns: DataTableColumn<T>[],
  options: UseTablePreferencesOptions = {},
): UseTablePreferencesReturn {
  const fullKey = `${STORAGE_PREFIX}.${storageKey}`;

  const allIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const requiredIds = useMemo(
    () => columns.filter((c) => c.required).map((c) => c.id),
    [columns],
  );

  const initialDefaults = useMemo<TablePreferencesState>(() => {
    const baseVisible = options.defaultVisibleIds ?? allIds;
    // garante required + remove ids inválidos
    const merged = Array.from(
      new Set([
        ...baseVisible.filter((id) => allIds.includes(id)),
        ...requiredIds,
      ]),
    );
    return {
      visibleColumnIds: merged,
      zebra: options.defaultZebra ?? false,
      density: options.defaultDensity ?? "comfortable",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds.join("|"), requiredIds.join("|")]);

  const [state, setState] = useState<TablePreferencesState>(() => {
    const stored = readStorage(fullKey);
    if (!stored) return initialDefaults;

    const cleanIds = Array.isArray(stored.visibleColumnIds)
      ? stored.visibleColumnIds.filter((id) => allIds.includes(id))
      : initialDefaults.visibleColumnIds;

    // garante required
    const withRequired = Array.from(new Set([...cleanIds, ...requiredIds]));

    return {
      visibleColumnIds:
        withRequired.length > 0
          ? withRequired
          : initialDefaults.visibleColumnIds,
      zebra:
        typeof stored.zebra === "boolean"
          ? stored.zebra
          : initialDefaults.zebra,
      density:
        stored.density === "compact" ||
        stored.density === "comfortable" ||
        stored.density === "spacious"
          ? stored.density
          : initialDefaults.density,
    };
  });

  // se o set de colunas mudar (ex.: feature flag), reconcilia ids inválidos
  useEffect(() => {
    setState((prev) => {
      const cleaned = prev.visibleColumnIds.filter((id) => allIds.includes(id));
      const withRequired = Array.from(new Set([...cleaned, ...requiredIds]));
      if (
        withRequired.length === prev.visibleColumnIds.length &&
        withRequired.every((id, i) => id === prev.visibleColumnIds[i])
      ) {
        return prev;
      }
      return { ...prev, visibleColumnIds: withRequired };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds.join("|"), requiredIds.join("|")]);

  // persistência
  useEffect(() => {
    writeStorage(fullKey, state);
  }, [fullKey, state]);

  const setZebra = useCallback(
    (value: boolean) => setState((s) => ({ ...s, zebra: value })),
    [],
  );
  const toggleZebra = useCallback(
    () => setState((s) => ({ ...s, zebra: !s.zebra })),
    [],
  );
  const setDensity = useCallback(
    (value: TableDensity) => setState((s) => ({ ...s, density: value })),
    [],
  );
  const setVisibleColumnIds = useCallback(
    (ids: string[]) =>
      setState((s) => {
        const cleaned = ids.filter((id) => allIds.includes(id));
        const withRequired = Array.from(new Set([...cleaned, ...requiredIds]));
        return { ...s, visibleColumnIds: withRequired };
      }),
    [allIds, requiredIds],
  );
  const toggleColumn = useCallback(
    (id: string) =>
      setState((s) => {
        if (requiredIds.includes(id)) return s; // não pode ocultar
        if (s.visibleColumnIds.includes(id)) {
          return {
            ...s,
            visibleColumnIds: s.visibleColumnIds.filter((x) => x !== id),
          };
        }
        // adiciona preservando ordem de `columns`
        const next = allIds.filter(
          (cid) => s.visibleColumnIds.includes(cid) || cid === id,
        );
        return { ...s, visibleColumnIds: next };
      }),
    [allIds, requiredIds],
  );
  const reset = useCallback(() => setState(initialDefaults), [initialDefaults]);

  return {
    ...state,
    setZebra,
    toggleZebra,
    setDensity,
    setVisibleColumnIds,
    toggleColumn,
    reset,
  };
}
