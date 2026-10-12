/**
 * useObrasPainel × fase de projeto: as etapas são um complemento da lista de
 * Projetos (não travam nem derrubam o Painel), a linha fica "desconhecida"
 * enquanto elas não chegam, e mover uma obra de etapa muda a tela na hora e
 * desfaz se o banco recusar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";
import type { PainelObra } from "@/hooks/usePainelObras";

const h = vi.hoisted(() => ({
  obras: [] as unknown[],
  painelLoading: false,
  portfolio: {
    data: undefined as Record<string, unknown[]> | undefined,
    isError: false,
    refetch: vi.fn(),
  },
  portfolioIds: [] as string[],
  move: vi.fn(),
}));

vi.mock("@/hooks/useContractDeadline", () => ({
  useObraDeadlines: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/hooks/usePainelObras", async (orig) => ({
  ...(await orig<typeof import("@/hooks/usePainelObras")>()),
  usePainelObras: () => ({
    obras: h.obras,
    isLoading: h.painelLoading,
    error: null,
    refetch: vi.fn(),
    updateObra: vi.fn(),
    isUpdating: false,
  }),
}));
vi.mock("@/hooks/useStaffUsers", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useStaffUsers")>()),
  useStaffUsers: () => ({ data: [{ id: "u1", nome: "Bruna", email: "b@bewild.com.br", perfil: "cs" }] }),
}));
vi.mock("@/hooks/useProjectPhase", () => ({
  useProjectPhasePortfolio: (ids: string[]) => {
    h.portfolioIds = ids;
    return h.portfolio;
  },
  useMoveProjectToPhaseStep: () => ({ mutateAsync: h.move }),
}));
// Hoje fixo (quarta, 14/10/2026).
vi.mock("@/lib/hojeDia", async (orig) => ({
  ...(await orig<typeof import("@/lib/hojeDia")>()),
  todayISO: () => "2026-10-14",
}));

import { useObrasPainel } from "../useObrasPainel";

const WEEK = { from: "2026-10-12", to: "2026-10-18" };

const obra = (p: Partial<PainelObra>): PainelObra =>
  ({
    id: "p1",
    nome: "Loft Itaim",
    customer_name: null,
    engineer_name: null,
    etapa: "Projeto 3D",
    inicio_etapa: null,
    status: null,
    relacionamento: null,
    responsavel_id: null,
    responsavel_nome: "Carla",
    ultima_atualizacao: "2026-10-01T12:00:00Z",
    is_project_phase: true,
    ...p,
  }) as PainelObra;

const step = (project_id: string, key: string, patch: Record<string, unknown> = {}) => ({
  id: `${project_id}-${key}`,
  project_id,
  step: key,
  done_at: null,
  due_date: null,
  responsible_user_id: null,
  notes: null,
  updated_by: null,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  ...patch,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useObrasPainel(WEEK), { wrapper }) };
}

beforeEach(() => {
  h.obras = [
    obra({ id: "p2", nome: "Studio Lapa" }),
    obra({ id: "p1", nome: "Loft Itaim" }),
    obra({ id: "x", nome: "Em execução", is_project_phase: false }),
  ];
  h.painelLoading = false;
  h.portfolio = { data: undefined, isError: false, refetch: vi.fn() };
  h.portfolioIds = [];
  h.move.mockReset().mockResolvedValue({});
});

describe("useObrasPainel: etapas da fase de projeto", () => {
  it("pede as etapas só das obras em fase de projeto", () => {
    setup();
    expect(h.portfolioIds).toEqual(["p1", "p2"]);
  });

  it("enquanto as etapas carregam: o Painel não espera e as linhas ficam desconhecidas", () => {
    const { result } = setup();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.phaseStatus).toBe("loading");
    expect(result.current.projetos).toHaveLength(2);
    for (const r of result.current.projetos) {
      expect(r.phase).toBeNull();
      expect(r.verdict).toBeNull();
    }
  });

  it("leitura das etapas falhou: o Painel não entra em erro; as linhas continuam desconhecidas", () => {
    h.portfolio = { ...h.portfolio, isError: true };
    const { result } = setup();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.phaseStatus).toBe("error");
    expect(result.current.projetos.map((r) => r.phase)).toEqual([null, null]);
    act(() => result.current.refetchPhase());
    expect(h.portfolio.refetch).toHaveBeenCalled();
  });

  it("com as etapas: etapa atual, veredito, responsável da etapa e a ordem por situação", () => {
    h.portfolio = {
      ...h.portfolio,
      data: {
        p1: [step("p1", "projeto_3d", { done_at: "2026-10-01" }), step("p1", "projeto_executivo", { due_date: "2026-10-10", responsible_user_id: "u1" })],
      },
    };
    const { result } = setup();
    expect(result.current.phaseStatus).toBe("ok");
    const [primeiro, segundo] = result.current.projetos;
    // Atrasada vem antes da obra sem etapa registrada.
    expect(primeiro).toMatchObject({
      id: "p1",
      verdict: { verdict: "atrasada", text: "Atrasada há 4 dias" },
      dueDate: "2026-10-10",
      stepResponsibleId: "u1",
      stepResponsible: "Bruna",
      responsible: "Carla",
    });
    expect(primeiro.phase?.current?.key).toBe("projeto_executivo");
    // Obra sem linha nenhuma = nada registrado (e isso, sim, se sabe).
    expect(segundo.id).toBe("p2");
    expect(segundo.phase?.registered).toBe(false);
    expect(segundo.verdict?.verdict).toBe("sem_prazo");
  });

  it("releitura que falha mantém as etapas que já estavam na tela", () => {
    h.portfolio = { ...h.portfolio, data: { p1: [step("p1", "projeto_3d", { done_at: "2026-10-01" })] }, isError: true };
    const { result } = setup();
    expect(result.current.phaseStatus).toBe("ok");
    expect(result.current.projetos.find((r) => r.id === "p1")?.phase?.doneCount).toBe(1);
  });

  it("obra nova em projeto: as que já estavam mantêm as etapas; a nova fica desconhecida até a leitura chegar", () => {
    h.portfolio = { ...h.portfolio, data: { p1: [step("p1", "projeto_3d", { done_at: "2026-10-01" })] } };
    const { result, rerender } = setup();
    expect(result.current.projetos.find((r) => r.id === "p2")?.phase?.registered).toBe(false);

    // A lista de obras muda → a chave da consulta muda → os dados somem por um instante.
    h.obras = [...(h.obras as PainelObra[]), obra({ id: "p3", nome: "Ap. Moema" })];
    h.portfolio = { ...h.portfolio, data: undefined };
    rerender();
    const porId = new Map(result.current.projetos.map((r) => [r.id, r]));
    expect(result.current.phaseStatus).toBe("loading");
    expect(porId.get("p1")?.phase?.doneCount).toBe(1);
    expect(porId.get("p2")?.phase?.registered).toBe(false);
    expect(porId.get("p3")?.phase).toBeNull(); // dela não se sabe nada: não é "sem etapa registrada"

    // Se a nova leitura falhar, não se confia mais no resultado antigo.
    h.portfolio = { ...h.portfolio, isError: true };
    rerender();
    expect(result.current.projetos.map((r) => r.phase)).toEqual([null, null, null]);
  });

  it("sem nenhuma obra em fase de projeto não há o que esperar", () => {
    h.obras = [obra({ id: "x", is_project_phase: false })];
    const { result } = setup();
    expect(result.current.phaseStatus).toBe("ok");
    expect(result.current.projetos).toEqual([]);
  });
});

describe("useObrasPainel: mover a obra de etapa", () => {
  const key = queryKeys.projectPhase.portfolio(["p1", "p2"]);
  const antes = () => ({
    p1: [
      step("p1", "projeto_3d", { done_at: "2026-09-20" }),
      step("p1", "projeto_executivo", { due_date: "2026-10-10", responsible_user_id: "u1" }),
    ],
  });
  const resumo = (rows: { step: string; done_at: string | null }[] | undefined) => rows?.map((r) => [r.step, r.done_at]);

  it("chama a RPC e mostra o resultado na hora, antes de o banco responder", async () => {
    let liberar: (v: unknown) => void = () => undefined;
    h.move.mockReturnValue(new Promise((resolve) => (liberar = resolve)));
    const { client, result } = setup();
    client.setQueryData(key, antes());

    let promessa: Promise<unknown> = Promise.resolve();
    act(() => {
      promessa = result.current.moveToPhaseStep("p1", "emissao_art");
    });
    await waitFor(() => expect(h.move).toHaveBeenCalledWith({ projectId: "p1", step: "emissao_art" }));
    const durante = client.getQueryData<Record<string, { step: string; done_at: string | null; due_date: string | null }[]>>(key);
    expect(resumo(durante?.p1)).toEqual([
      ["projeto_3d", "2026-09-20"], // quem já tinha data fica com ela
      ["projeto_executivo", "2026-10-14"],
      ["medicao_fina", "2026-10-14"],
      ["emissao_art", null],
    ]);
    // Prazo e responsável não mudam.
    expect(durante?.p1[1]).toMatchObject({ due_date: "2026-10-10", responsible_user_id: "u1" });

    liberar({});
    await act(async () => {
      await promessa;
    });
  });

  it("obra sem etapa registrada posicionada na primeira etapa passa a ter etapa na tela", async () => {
    const { client, result } = setup();
    client.setQueryData(key, antes());
    await act(async () => {
      await result.current.moveToPhaseStep("p2", "projeto_3d");
    });
    expect(h.move).toHaveBeenCalledWith({ projectId: "p2", step: "projeto_3d" });
    const depois = client.getQueryData<Record<string, { step: string; done_at: string | null }[]>>(key);
    expect(resumo(depois?.p2)).toEqual([["projeto_3d", null]]);
    expect(resumo(depois?.p1)).toEqual(resumo(antes().p1)); // as outras obras não mudam
  });

  it("se o banco recusar, a tela volta ao que era e o erro sobe para quem chamou", async () => {
    h.move.mockRejectedValue(new Error("Esta obra já saiu da fase de projeto"));
    const { client, result } = setup();
    client.setQueryData(key, antes());
    const invalidate = vi.spyOn(client, "invalidateQueries");

    let erro: unknown = null;
    await act(async () => {
      await result.current.moveToPhaseStep("p1", "emissao_art").catch((e) => (erro = e));
    });
    expect((erro as Error).message).toBe("Esta obra já saiu da fase de projeto");
    expect(client.getQueryData(key)).toEqual(antes());
    // E relê do banco, para não ficar com uma leitura cancelada pela metade.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.projectPhase.portfolios() });
  });
});
