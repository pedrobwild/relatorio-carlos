/**
 * Hook que persiste "saved views" do Painel de Obras em `localStorage`.
 *
 * Chave: `painelObras.views.<userId>` (escopada por usuário para que
 * preferências não vazem entre logins). Cada view armazena `{ id, name,
 * filters, columns? }`.
 *
 * Ao montar, hidrata a partir do storage (parsing seguro). Operações:
 *  - upsertView(view)         — cria ou substitui
 *  - removeView(id)           — só remove views custom (não builtin)
 *  - reorderViews(ids[])      — futuro
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL, EMPTY_FILTERS, type SavedView } from './types';

const STORAGE_PREFIX = 'painelObras.views.';

export const BUILTIN_VIEWS: SavedView[] = [
  { id: 'todas', name: 'Todas', filters: { ...EMPTY_FILTERS }, builtin: true },
  {
    id: 'criticas',
    name: 'Críticas',
    builtin: true,
    filters: { ...EMPTY_FILTERS, filterStatus: 'Atrasado' },
  },
  {
    id: 'entregando-mes',
    name: 'Entregando este mês',
    builtin: true,
    filters: { ...EMPTY_FILTERS, sortKey: 'entrega_oficial', sortDir: 'asc' },
  },
  {
    id: 'aguardando-cliente',
    name: 'Aguardando cliente',
    builtin: true,
    filters: { ...EMPTY_FILTERS, filterStatus: 'Aguardando' },
  },
];

export function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_PREFIX}${userId ?? 'anonymous'}`;
}

function isValidView(v: unknown): v is SavedView {
  if (!v || typeof v !== 'object') return false;
  const view = v as Record<string, unknown>;
  return (
    typeof view.id === 'string' &&
    typeof view.name === 'string' &&
    typeof view.filters === 'object' &&
    view.filters !== null
  );
}

export function loadViews(userId: string | null | undefined): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidView);
  } catch {
    return [];
  }
}

export function persistViews(userId: string | null | undefined, views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(views));
  } catch {
    // localStorage cheio / privado — silencia.
  }
}

interface UseSavedViewsReturn {
  /** Builtin + custom merged, na ordem (builtin primeiro). */
  views: SavedView[];
  /** Apenas as views custom (úteis para listar com botão remover). */
  customViews: SavedView[];
  upsertView: (view: SavedView) => void;
  removeView: (id: string) => void;
  resetCustom: () => void;
}

export function useSavedViews(userId: string | null | undefined): UseSavedViewsReturn {
  const [customViews, setCustomViews] = useState<SavedView[]>(() => loadViews(userId));

  // Re-hidrata quando userId muda (ex: troca de conta).
  useEffect(() => {
    setCustomViews(loadViews(userId));
  }, [userId]);

  // Persiste a cada mudança.
  useEffect(() => {
    persistViews(userId, customViews);
  }, [userId, customViews]);

  const upsertView = useCallback((view: SavedView) => {
    if (view.builtin) return; // protege builtin
    setCustomViews((prev) => {
      const idx = prev.findIndex((v) => v.id === view.id);
      if (idx === -1) return [...prev, view];
      const next = [...prev];
      next[idx] = view;
      return next;
    });
  }, []);

  const removeView = useCallback((id: string) => {
    setCustomViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const resetCustom = useCallback(() => setCustomViews([]), []);

  const views = useMemo(() => [...BUILTIN_VIEWS, ...customViews], [customViews]);

  return { views, customViews, upsertView, removeView, resetCustom };
}
