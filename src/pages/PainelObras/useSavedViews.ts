/**
 * useSavedViews — saved views (filters + columns) persistidas em localStorage.
 *
 * Cada usuário tem sua própria coleção, sob a chave
 *   `painelObras.views.<userId>`
 *
 * Pensado para o cockpit do PainelObras (Bloco 4): tabs no topo da página
 * com "Críticas", "Entregando este mês", "Aguardando cliente" + custom.
 *
 * Mantém contrato simples: o callsite controla o shape de `filters` e
 * `columns` — este hook só persiste e expõe CRUD.
 */

import { useCallback, useEffect, useState } from "react";

export interface SavedView<
  TFilters = Record<string, unknown>,
  TColumns = string[],
> {
  id: string;
  name: string;
  filters: TFilters;
  columns: TColumns;
  /** ISO timestamp — útil para ordenar as views custom mais recentes. */
  updatedAt: string;
  /** True para views default que não devem ser editáveis pelo usuário. */
  builtin?: boolean;
}

export interface UseSavedViewsResult<TFilters, TColumns> {
  views: Array<SavedView<TFilters, TColumns>>;
  saveView: (view: Omit<SavedView<TFilters, TColumns>, "updatedAt">) => void;
  deleteView: (id: string) => void;
  renameView: (id: string, name: string) => void;
  reset: () => void;
}

const STORAGE_PREFIX = "painelObras.views.";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function readFromStorage<TFilters, TColumns>(
  userId: string,
): Array<SavedView<TFilters, TColumns>> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Array<SavedView<TFilters, TColumns>>;
  } catch {
    return [];
  }
}

function writeToStorage<TFilters, TColumns>(
  userId: string,
  views: Array<SavedView<TFilters, TColumns>>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(views));
  } catch {
    // localStorage pode estar cheio ou bloqueado — silencioso por design,
    // a persistência é "best effort". Erros reais são capturados pelo
    // `errorMonitoring` no callsite.
  }
}

export function useSavedViews<
  TFilters = Record<string, unknown>,
  TColumns = string[],
>(userId: string | null | undefined): UseSavedViewsResult<TFilters, TColumns> {
  const [views, setViews] = useState<Array<SavedView<TFilters, TColumns>>>(
    () => (userId ? readFromStorage<TFilters, TColumns>(userId) : []),
  );

  // Reload when userId changes (login/logout) — avoids leaking views across users.
  useEffect(() => {
    if (!userId) {
      setViews([]);
      return;
    }
    setViews(readFromStorage<TFilters, TColumns>(userId));
  }, [userId]);

  const persist = useCallback(
    (next: Array<SavedView<TFilters, TColumns>>) => {
      setViews(next);
      if (userId) writeToStorage(userId, next);
    },
    [userId],
  );

  const saveView = useCallback(
    (view: Omit<SavedView<TFilters, TColumns>, "updatedAt">) => {
      const updatedAt = new Date().toISOString();
      setViews((current) => {
        const existing = current.findIndex((v) => v.id === view.id);
        const nextView: SavedView<TFilters, TColumns> = { ...view, updatedAt };
        const next =
          existing >= 0
            ? current.map((v, i) => (i === existing ? nextView : v))
            : [...current, nextView];
        if (userId) writeToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const deleteView = useCallback(
    (id: string) => {
      setViews((current) => {
        const next = current.filter((v) => v.id !== id || v.builtin);
        if (userId) writeToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      const updatedAt = new Date().toISOString();
      setViews((current) => {
        const next = current.map((v) =>
          v.id === id && !v.builtin ? { ...v, name, updatedAt } : v,
        );
        if (userId) writeToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const reset = useCallback(() => persist([]), [persist]);

  return { views, saveView, deleteView, renameView, reset };
}
