/**
 * Hooks da fase de projeto: leitura por obra e de carteira, erro que sobe
 * (para a tela mostrar "tentar de novo") e gravações que mandam reler o que o
 * banco mudou — as etapas, as listas de obras e o prazo contratual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  listMany: vi.fn(),
  save: vi.fn(),
  move: vi.fn(),
}));

vi.mock("@/infra/repositories/projectPhase.repository", () => ({
  projectPhaseRepo: { listSteps: h.list, listStepsForProjects: h.listMany, saveStep: h.save, moveToStep: h.move },
}));

import {
  useMoveProjectToPhaseStep,
  useProjectPhasePortfolio,
  useProjectPhaseSteps,
  useSaveProjectPhaseStep,
} from "../useProjectPhase";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const step = (project_id: string, key: string, patch: Record<string, unknown> = {}) => ({
  id: `${project_id}-${key}`,
  project_id,
  step: key,
  done_at: null,
  due_date: null,
  responsible_user_id: null,
  notes: null,
  ...patch,
});

/** Caches que dependem do que o gatilho do banco muda em `projects`. */
function seedDependents(client: QueryClient) {
  const keys = {
    stepsP1: queryKeys.projectPhase.steps("p1"),
    stepsP2: queryKeys.projectPhase.steps("p2"),
    portfolio: queryKeys.projectPhase.portfolio(["p1", "p2"]),
    projectList: queryKeys.projects.list({ status: "active" }),
    detailP1: queryKeys.projects.detail("p1"),
    detailP2: queryKeys.projects.detail("p2"),
    deadlineList: queryKeys.contractDeadline.list(),
    deadlineP1: queryKeys.contractDeadline.byProject("p1"),
    obrasPanel: queryKeys.obrasPanel.stages(["p1", "p2"]),
    studioP1: queryKeys.studioInfo.byProject("p1"),
  };
  client.setQueryData(keys.stepsP1, [step("p1", "projeto_3d", { due_date: "2026-10-20" })]);
  client.setQueryData(keys.stepsP2, [step("p2", "projeto_3d")]);
  for (const key of [keys.portfolio, keys.projectList, keys.detailP1, keys.detailP2, keys.deadlineList, keys.deadlineP1, keys.obrasPanel, keys.studioP1]) {
    client.setQueryData(key, {});
  }
  const invalidated = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
  return { keys, invalidated };
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
});

describe("useProjectPhaseSteps", () => {
  it("carrega as etapas registradas da obra", async () => {
    const rows = [step("p1", "projeto_3d", { done_at: "2026-10-01" })];
    h.list.mockResolvedValue({ data: rows, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhaseSteps("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.list).toHaveBeenCalledWith("p1");
    expect(result.current.data).toEqual(rows);
  });

  it("obra sem nada registrado: lista vazia (carregou, não há linhas)", async () => {
    h.list.mockResolvedValue({ data: [], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhaseSteps("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("erro do banco vira erro da consulta (não uma obra 'sem etapas')", async () => {
    h.list.mockResolvedValue({ data: [], error: { message: "permission denied", code: "42501" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhaseSteps("p1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("sem obra não consulta", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhaseSteps(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(h.list).not.toHaveBeenCalled();
  });
});

describe("useProjectPhasePortfolio", () => {
  it("uma leitura para todas as obras, agrupada por obra", async () => {
    h.listMany.mockResolvedValue({
      data: [step("p2", "projeto_3d"), step("p1", "projeto_3d"), step("p1", "projeto_executivo")],
      error: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhasePortfolio(["p2", "p1", "p3", "p1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.listMany).toHaveBeenCalledTimes(1);
    expect(h.listMany).toHaveBeenCalledWith(["p1", "p2", "p3"]);
    expect(result.current.data?.p1?.map((s) => s.step)).toEqual(["projeto_3d", "projeto_executivo"]);
    expect(result.current.data?.p2).toHaveLength(1);
    // Obra sem nada registrado não tem chave.
    expect(result.current.data?.p3).toBeUndefined();
  });

  it("o resultado sobrevive ao cache gravado no aparelho (JSON): nada de Map", async () => {
    h.listMany.mockResolvedValue({ data: [step("p1", "projeto_3d")], error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhasePortfolio(["p1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(JSON.stringify(result.current.data))).toEqual(result.current.data);
  });

  it("a ordem dos ids não cria outra consulta", async () => {
    h.listMany.mockResolvedValue({ data: [], error: null });
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(({ ids }) => useProjectPhasePortfolio(ids), {
      wrapper,
      initialProps: { ids: ["p1", "p2"] },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ ids: ["p2", "p1"] });
    expect(h.listMany).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().findAll({ queryKey: queryKeys.projectPhase.portfolios() })).toHaveLength(1);
  });

  it("erro do banco vira erro da consulta", async () => {
    h.listMany.mockResolvedValue({ data: [], error: { message: "statement timeout", code: "57014" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhasePortfolio(["p1"]), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem obras não consulta", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useProjectPhasePortfolio([]), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(h.listMany).not.toHaveBeenCalled();
  });
});

describe("useSaveProjectPhaseStep", () => {
  it("grava só o que foi enviado e a etapa já aparece atualizada", async () => {
    const saved = step("p1", "projeto_3d", { due_date: "2026-10-20", done_at: "2026-10-12" });
    h.save.mockResolvedValue({ data: saved, error: null });
    h.list.mockResolvedValue({ data: [saved], error: null });
    const { client, wrapper } = setup();
    const { keys } = seedDependents(client);

    const { result } = renderHook(() => useSaveProjectPhaseStep(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ project_id: "p1", step: "projeto_3d", done_at: "2026-10-12" });
    });

    expect(h.save).toHaveBeenCalledWith({ project_id: "p1", step: "projeto_3d", done_at: "2026-10-12" });
    expect(client.getQueryData(keys.stepsP1)).toEqual([saved]);
  });

  it("etapa que ainda não tinha linha entra na lista em cache", async () => {
    const saved = step("p1", "emissao_art", { due_date: "2026-11-01" });
    h.save.mockResolvedValue({ data: saved, error: null });
    const { client, wrapper } = setup();
    const { keys } = seedDependents(client);

    const { result } = renderHook(() => useSaveProjectPhaseStep(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ project_id: "p1", step: "emissao_art", due_date: "2026-11-01" });
    });
    const cached = client.getQueryData<{ step: string }[]>(keys.stepsP1);
    expect(cached?.map((s) => s.step)).toEqual(["projeto_3d", "emissao_art"]);
  });

  it("manda reler as etapas, a carteira, as listas de obras e o prazo contratual", async () => {
    h.save.mockResolvedValue({ data: step("p1", "aprovacao_condominio", { done_at: "2026-10-08" }), error: null });
    const { client, wrapper } = setup();
    const { keys, invalidated } = seedDependents(client);

    const { result } = renderHook(() => useSaveProjectPhaseStep(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ project_id: "p1", step: "aprovacao_condominio", done_at: "2026-10-08" });
    });

    expect(invalidated(keys.stepsP1)).toBe(true);
    expect(invalidated(keys.portfolio)).toBe(true);
    // O banco mudou painel_etapa, datas e início do contrato em projects.
    expect(invalidated(keys.projectList)).toBe(true);
    expect(invalidated(keys.detailP1)).toBe(true);
    expect(invalidated(keys.deadlineList)).toBe(true);
    expect(invalidated(keys.deadlineP1)).toBe(true);
    expect(invalidated(keys.obrasPanel)).toBe(true);
    // Outra obra e outros assuntos ficam quietos.
    expect(invalidated(keys.stepsP2)).toBe(false);
    expect(invalidated(keys.detailP2)).toBe(false);
    expect(invalidated(keys.studioP1)).toBe(false);
  });

  it("recusa do banco rejeita e não mexe em nada no cache", async () => {
    h.save.mockResolvedValue({
      data: null,
      error: { message: "A data de conclusão não pode ser no futuro", code: "23514" },
    });
    const { client, wrapper } = setup();
    const { keys, invalidated } = seedDependents(client);
    const before = client.getQueryData(keys.stepsP1);

    const { result } = renderHook(() => useSaveProjectPhaseStep(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ project_id: "p1", step: "projeto_3d", done_at: "2099-01-01" }),
      ).rejects.toMatchObject({ code: "23514" });
    });
    expect(client.getQueryData(keys.stepsP1)).toEqual(before);
    expect(invalidated(keys.stepsP1)).toBe(false);
    expect(invalidated(keys.projectList)).toBe(false);
  });
});

describe("useMoveProjectToPhaseStep", () => {
  it("chama a RPC e manda reler tudo o que ela muda", async () => {
    h.move.mockResolvedValue({ data: null, error: null });
    const { client, wrapper } = setup();
    const { keys, invalidated } = seedDependents(client);

    const { result } = renderHook(() => useMoveProjectToPhaseStep(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ projectId: "p1", step: "emissao_art" });
    });

    expect(h.move).toHaveBeenCalledWith("p1", "emissao_art");
    for (const key of [keys.stepsP1, keys.portfolio, keys.projectList, keys.detailP1, keys.deadlineList, keys.obrasPanel]) {
      expect(invalidated(key)).toBe(true);
    }
    expect(invalidated(keys.stepsP2)).toBe(false);
  });

  it("sem permissão / obra fora da fase de projeto: rejeita e não invalida nada", async () => {
    h.move.mockResolvedValue({ data: null, error: { message: "Sem acesso a esta obra", code: "42501" } });
    const { client, wrapper } = setup();
    const { keys, invalidated } = seedDependents(client);

    const { result } = renderHook(() => useMoveProjectToPhaseStep(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ projectId: "p1", step: "emissao_art" })).rejects.toMatchObject({
        code: "42501",
      });
    });
    expect(invalidated(keys.stepsP1)).toBe(false);
    expect(invalidated(keys.projectList)).toBe(false);
  });
});
