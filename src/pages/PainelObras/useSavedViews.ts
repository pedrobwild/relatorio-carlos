/**
 * useSavedViews — persists user-defined "views" (filters + columns) for a
 * cockpit page. Stored in `localStorage` keyed by `<page>.views.<userId>`
 * so two users on the same browser don't see each other's views.
 *
 * Default views are not persisted; only user-defined ones go to storage.
 *
 * Generic over the `filters` shape so each cockpit (PainelObras, Compras,
 * etc) can use it with its own schema.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface SavedView<TFilters> {
  /** Stable id (uuid-ish) — distinct from name so renames don't break refs. */
  id: string;
  name: string;
  filters: TFilters;
  columns?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UseSavedViewsOptions<TFilters> {
  pageKey: string;
  userId: string | null | undefined;
  /**
   * Built-in views that are always shown but never persisted. Their ids
   * should be stable strings so they survive reloads.
   */
  defaults?: Array<Omit<SavedView<TFilters>, 'createdAt' | 'updatedAt'>>;
}

function storageKey(pageKey: string, userId: string | null | undefined): string {
  return `${pageKey}.views.${userId ?? 'anonymous'}`;
}

function readFromStorage<TFilters>(key: string): SavedView<TFilters>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView<TFilters>[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage<TFilters>(key: string, views: SavedView<TFilters>[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    // Quota exceeded or storage disabled — ignore silently.
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSavedViews<TFilters>({
  pageKey,
  userId,
  defaults = [],
}: UseSavedViewsOptions<TFilters>) {
  const key = storageKey(pageKey, userId);
  const [userViews, setUserViews] = useState<SavedView<TFilters>[]>(() =>
    readFromStorage<TFilters>(key),
  );

  // Re-read when the user changes (login switch, etc).
  useEffect(() => {
    setUserViews(readFromStorage<TFilters>(key));
  }, [key]);

  const persist = useCallback(
    (next: SavedView<TFilters>[]) => {
      setUserViews(next);
      writeToStorage(key, next);
    },
    [key],
  );

  const saveView = useCallback(
    (input: { name: string; filters: TFilters; columns?: string[] }): SavedView<TFilters> => {
      const now = new Date().toISOString();
      const view: SavedView<TFilters> = {
        id: makeId(),
        name: input.name.trim(),
        filters: input.filters,
        columns: input.columns,
        createdAt: now,
        updatedAt: now,
      };
      persist([...userViews, view]);
      return view;
    },
    [persist, userViews],
  );

  const updateView = useCallback(
    (id: string, patch: Partial<Pick<SavedView<TFilters>, 'name' | 'filters' | 'columns'>>) => {
      const now = new Date().toISOString();
      persist(
        userViews.map((v) =>
          v.id === id ? { ...v, ...patch, updatedAt: now } : v,
        ),
      );
    },
    [persist, userViews],
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(userViews.filter((v) => v.id !== id));
    },
    [persist, userViews],
  );

  const allViews = useMemo<SavedView<TFilters>[]>(() => {
    const now = new Date(0).toISOString();
    const decoratedDefaults = defaults.map<SavedView<TFilters>>((d) => ({
      ...d,
      createdAt: now,
      updatedAt: now,
    }));
    return [...decoratedDefaults, ...userViews];
  }, [defaults, userViews]);

  return {
    views: allViews,
    userViews,
    saveView,
    updateView,
    deleteView,
  };
}
