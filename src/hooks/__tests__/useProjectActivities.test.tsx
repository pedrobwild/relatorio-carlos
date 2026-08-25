import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectActivities } from "../useProjectActivities";

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
      expect(await result.current.saveActivities([activity])).toBe(true);
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
      expect(await result.current.saveActivities([activity])).toBe(false);
    });

    expect(from).toHaveBeenCalledTimes(1);
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
    let firstSave: Promise<boolean>;
    let secondSave: Promise<boolean>;

    act(() => {
      firstSave = result.current.saveActivities([activity]);
      secondSave = result.current.saveActivities([
        { ...activity, description: "Demolições atualizadas" },
      ]);
    });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    releaseFirst?.();

    await act(async () => {
      expect(await firstSave).toBe(true);
      expect(await secondSave).toBe(true);
    });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(rpc.mock.calls[1][1].p_rows[0].description).toBe(
      "Demolições atualizadas",
    );
  });
});