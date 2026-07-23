/**
 * usePainelSavedViews — CRUD local de "visões salvas" do Painel de Obras.
 *
 * Cada visão é um snapshot da querystring (filtros, ordenação, exceção).
 * Persistido em localStorage por usuário (chave `bwild:painel:views:v1:{uid}`),
 * sem migration nem dependência do banco.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export interface SavedView {
  id: string;
  name: string;
  query: string; // ex: "fase=obras&excecao=nc"
  createdAt: string;
}

const STORAGE_PREFIX = "bwild:painel:views:v1:";

function keyFor(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}${userId}`;
}

function readViews(userId: string | undefined | null): SavedView[] {
  const key = keyFor(userId);
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v) =>
        typeof v?.id === "string" &&
        typeof v?.name === "string" &&
        typeof v?.query === "string",
    );
  } catch {
    return [];
  }
}

function writeViews(userId: string | undefined | null, views: SavedView[]) {
  const key = keyFor(userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    /* storage indisponível — ignora */
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function usePainelSavedViews() {
  const { user } = useAuth();
  const uid = user?.id;
  const [views, setViews] = useState<SavedView[]>(() => readViews(uid));

  // Rehidrata quando o usuário muda (login/switch).
  useEffect(() => {
    setViews(readViews(uid));
  }, [uid]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      writeViews(uid, next);
    },
    [uid],
  );

  const save = useCallback(
    (name: string, query: string): SavedView | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const view: SavedView = {
        id: makeId(),
        name: trimmed.slice(0, 60),
        query: query.startsWith("?") ? query.slice(1) : query,
        createdAt: new Date().toISOString(),
      };
      persist([view, ...views].slice(0, 20));
      return view;
    },
    [views, persist],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persist(
        views.map((v) =>
          v.id === id ? { ...v, name: trimmed.slice(0, 60) } : v,
        ),
      );
    },
    [views, persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [views, persist],
  );

  return { views, save, rename, remove };
}
