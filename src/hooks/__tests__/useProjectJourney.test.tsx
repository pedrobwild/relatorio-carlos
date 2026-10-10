/**
 * useProjectJourney — consulta da Jornada.
 *
 *  1. Erro nas etapas é propagado: antes virava `stages: []` e essa "jornada
 *     vazia" era cacheada/persistida no localStorage por cima dos dados bons.
 *  2. Rodapé/CSM seguem best-effort.
 *  3. Rebusca ao voltar o foco (o padrão do app é refetchOnWindowFocus=false).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

type Result = { data: unknown; error: unknown };

const db = vi.hoisted(() => ({
  results: {} as Record<string, Result>,
  calls: {} as Record<string, number>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    db.calls[table] = (db.calls[table] ?? 0) + 1;
    const resolve = () =>
      Promise.resolve(db.results[table] ?? { data: null, error: null });
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      maybeSingle: resolve,
      then: (
        onFulfilled: (v: Result) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => resolve().then(onFulfilled, onRejected),
    };
    return builder;
  };
  return { supabase: { from } };
});

vi.mock("@/lib/projectDocumentUrl", () => ({
  signProjectDocumentUrl: vi.fn(async (v: string) => v),
}));

import { useProjectJourney } from "@/hooks/useProjectJourney";

const STAGES = [
  { id: "s1", project_id: "p1", sort_order: 1, name: "Briefing", status: "completed" },
  { id: "s2", project_id: "p1", sort_order: 2, name: "Projeto 3D", status: "in_progress" },
];

function okResults() {
  db.results = {
    journey_hero: { data: { id: "h1", project_id: "p1" }, error: null },
    journey_footer: { data: { id: "f1", project_id: "p1", text: "" }, error: null },
    journey_csm: { data: null, error: null },
    journey_stages: { data: STAGES, error: null },
    journey_todos: {
      data: [{ id: "t1", stage_id: "s2", owner: "client", text: "Aprovar" }],
      error: null,
    },
  };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Espelha o padrão do app (src/lib/queryClient.ts).
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60_000 },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProjectJourney("p1"), { wrapper });
}

describe("useProjectJourney", () => {
  beforeEach(() => {
    db.calls = {};
    okResults();
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it("monta as etapas com seus checklists", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stages.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(result.current.data?.stages[1].todos).toHaveLength(1);
  });

  it("erro nas etapas vira erro da query, não uma jornada vazia", async () => {
    db.results.journey_stages = {
      data: null,
      error: { message: "upstream timeout", code: "57014" },
    };

    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });

  it("falha transitória numa rebusca mantém as etapas já carregadas", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    db.results.journey_stages = {
      data: null,
      error: { message: "upstream timeout", code: "57014" },
    };
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.stages.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("erro nos checklists também é propagado", async () => {
    db.results.journey_todos = {
      data: null,
      error: { message: "boom", code: "XX000" },
    };

    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("rodapé e CSM continuam best-effort", async () => {
    db.results.journey_footer = { data: null, error: { message: "boom" } };
    db.results.journey_csm = { data: null, error: { message: "boom" } };

    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.footer).toBeNull();
    expect(result.current.data?.csm).toBeNull();
    expect(result.current.data?.stages).toHaveLength(2);
  });

  it("rebusca ao voltar o foco para o app depois de 30s", async () => {
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow);
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(db.calls.journey_stages).toBe(1);

    // Voltar logo em seguida não rebusca (dado ainda fresco)…
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });
    expect(db.calls.journey_stages).toBe(1);

    // …mas depois de 30s rebusca — e não 5 min, como o padrão do app.
    nowSpy.mockReturnValue(realNow + 31_000);
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(db.calls.journey_stages).toBe(2));
    nowSpy.mockRestore();
  });
});
