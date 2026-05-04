/**
 * Tests for useBwildAgent hooks (Assessor BWild).
 *
 * Cobre:
 * - mutation aciona invokeBwildAgent com project_id correto
 * - status != 'success' vira erro
 * - sucesso invalida queries de state e events
 * - getProjectState e listAgentEvents alimentam as queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  useAgentEventsQuery,
  useBwildAgentMutation,
  useProjectStateMemoryQuery,
} from "../useBwildAgent";
import { queryKeys } from "@/lib/queryKeys";

const invokeBwildAgentMock = vi.fn();
const getProjectStateMock = vi.fn();
const listAgentEventsMock = vi.fn();

vi.mock("@/infra/edgeFunctions", () => ({
  invokeBwildAgent: (req: unknown) => invokeBwildAgentMock(req),
}));

vi.mock("@/infra/repositories", () => ({
  agentMemoryRepo: {
    getProjectState: (projectId: string) => getProjectStateMock(projectId),
    listAgentEvents: (projectId: string, opts?: { limit?: number }) =>
      listAgentEventsMock(projectId, opts),
  },
}));

vi.mock("../useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe("useBwildAgentMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama invokeBwildAgent com project_id e propaga payload", async () => {
    invokeBwildAgentMock.mockResolvedValue({
      data: {
        event_id: "ev-1",
        project_id: "p-1",
        routed_agent: "schedule_planner",
        routing_reason: "event_type",
        status: "success",
        response: { diagnostico: "ok" },
        state_diff: {},
        state_version: 1,
        latency_ms: 42,
        error: null,
      },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBwildAgentMutation("p-1"), {
      wrapper: Wrapper,
    });

    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        event_type: "schedule_request",
        content: "cronograma da semana",
        source: "gestor",
      });
    });

    expect(invokeBwildAgentMock).toHaveBeenCalledWith({
      project_id: "p-1",
      event_type: "schedule_request",
      content: "cronograma da semana",
      source: "gestor",
    });
    expect(returned?.routed_agent).toBe("schedule_planner");
  });

  it("rejeita quando o backend devolve status diferente de success", async () => {
    invokeBwildAgentMock.mockResolvedValue({
      data: {
        event_id: null,
        project_id: "p-1",
        routed_agent: "master_bwild",
        routing_reason: "default",
        status: "llm_error",
        response: null,
        state_diff: {},
        state_version: null,
        latency_ms: 10,
        error: "modelo fora do ar",
      },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBwildAgentMutation("p-1"), {
      wrapper: Wrapper,
    });

    await expect(
      result.current.mutateAsync({
        event_type: "field_problem",
        content: "fissura na laje",
      }),
    ).rejects.toThrow("modelo fora do ar");
  });

  it("falha imediatamente sem projectId", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBwildAgentMutation(undefined), {
      wrapper: Wrapper,
    });

    await expect(
      result.current.mutateAsync({
        event_type: "field_problem",
        content: "qualquer coisa",
      }),
    ).rejects.toThrow(/projectId obrigat/i);
  });

  it("invalida queries de state e events em sucesso", async () => {
    invokeBwildAgentMock.mockResolvedValue({
      data: {
        event_id: "ev-2",
        project_id: "p-1",
        routed_agent: "cost_engineer",
        routing_reason: "keyword_match",
        status: "success",
        response: { diagnostico: "ok" },
        state_diff: { financial_state: { contingency: "5%" } },
        state_version: 2,
        latency_ms: 20,
        error: null,
      },
      error: null,
    });

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useBwildAgentMutation("p-1"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        event_type: "budget_request",
        content: "estourou margem",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.agent.state("p-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.agent.events("p-1"),
    });
  });
});

describe("useProjectStateMemoryQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a memória do projeto", async () => {
    getProjectStateMock.mockResolvedValue({
      data: {
        id: "mem-1",
        project_id: "p-1",
        state: { project_context: { client_name: "Acme" } },
        version: 3,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectStateMemoryQuery("p-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.data?.version).toBe(3));
    expect(getProjectStateMock).toHaveBeenCalledWith("p-1");
  });

  it("fica desabilitada sem projectId", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectStateMemoryQuery(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getProjectStateMock).not.toHaveBeenCalled();
  });
});

describe("useAgentEventsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repassa o limit para o repositório", async () => {
    listAgentEventsMock.mockResolvedValue({ data: [], error: null });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAgentEventsQuery("p-1", 5), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listAgentEventsMock).toHaveBeenCalledWith("p-1", { limit: 5 });
  });
});
