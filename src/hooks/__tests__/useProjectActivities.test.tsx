import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useProjectActivities,
  type SaveActivitiesResult,
} from "../useProjectActivities";

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from,
    rpc,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("../useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/queryKeys", () => ({
  queryKeys: { activities: { list: (id?: string) => ["activities", id] } },
  invalidateActivityQueries: vi.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const activity = {
  id: "8e1050e0-2f42-44a2-adfd-bfd7a38c27d2",
  description: "Demolições",
  planned_start: "2026-08-24",
  planned_end: "2026-08-28",
  weight: 10,
  sort_order: 0,
};

describe("useProjectActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    rpc.mockResolvedValue({ error: null });
  });

  it("preserva o id da atividade no payload da RPC", async () => {
    const { result } = renderHook(() => useProjectActivities("project-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      expect(await result.current.saveActivities([activity])).toEqual({ ok: true });
    });

    expect(rpc).toHaveBeenCalledWith(
      "replace_project_activities",
      expect.objectContaining({
        p_rows: [expect.objectContaining({ id: activity.id })],
      }),
    );
  });

  it("não executa fallback destrutivo quando a RPC falha", async () => {
    rpc.mockResolvedValueOnce({ error: new Error("falha controlada") });
    const { result } = renderHook(() => useProjectActivities("project-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const falha = await result.current.saveActivities([activity]);
      expect(falha.ok).toBe(false);
    });

    expect(from).toHaveBeenCalledTimes(1);
  });


  it("propaga o motivo real da RPC e marca erro de permissão como permanente", async () => {
    // Forma real do postgrest-js: corpo cru em `error`, `status` como irmão.
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Sem permissão para editar o cronograma desta obra",
        details: "",
        hint: "",
        code: "P0001",
      },
      status: 400,
      statusText: "Bad Request",
    });
    const { result } = renderHook(() => useProjectActivities("project-1"), {
      wrapper: createWrapper(),
    });

    let saved: SaveActivitiesResult;
    await act(async () => {
      saved = await result.current.saveActivities([activity]);
    });

    expect(saved!.ok).toBe(false);
    if (saved!.ok) throw new Error("esperava falha");
    // Antes: virava `false` num catch vazio e o usuário só via "tente novamente".
    expect(saved!.message).toBe(
      "Sem permissão para editar o cronograma desta obra",
    );
    // Retentar isto em loop foi o que travou o cronograma em 31/08.
    expect(saved!.permanent).toBe(true);
  });

  it("serializa salvamentos concorrentes e persiste a alteração mais recente", async () => {
    let releaseFirst: (() => void) | undefined;
    rpc
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          releaseFirst = () => resolve({ error: null });
        }),
      )
      .mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useProjectActivities("project-1"), {
      wrapper: createWrapper(),
    });
    let firstSave: Promise<SaveActivitiesResult>;
    let secondSave: Promise<SaveActivitiesResult>;

    act(() => {
      firstSave = result.current.saveActivities([activity]);
      secondSave = result.current.saveActivities([
        { ...activity, description: "Demolições atualizadas" },
      ]);
    });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    releaseFirst?.();

    await act(async () => {
      expect(await firstSave).toEqual({ ok: true });
      expect(await secondSave).toEqual({ ok: true });
    });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(rpc.mock.calls[1][1].p_rows[0].description).toBe(
      "Demolições atualizadas",
    );
  });
});