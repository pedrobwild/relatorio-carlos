/**
 * Etapa atual da obra no card (ProjectCardSummary).
 *
 * Regressão que este teste segura: a busca lia `atividades`, a tabela LEGADA
 * (zero linhas em produção) em vez de `project_activities`, o cronograma vivo.
 * Sempre voltava vazio, então a "etapa atual" ficava em branco no card de toda
 * obra em execução — que é exatamente onde o componente habilita esta busca.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];

function makeChain(table: string, rows: unknown[]) {
  const entry = { table, filters: {} as Record<string, unknown> };
  calls.push(entry);
  const chain: Record<string, unknown> = {};
  const step = (name: string) => (...args: unknown[]) => {
    entry.filters[name] = args;
    return chain;
  };
  Object.assign(chain, {
    select: step("select"),
    eq: step("eq"),
    is: step("is"),
    order: step("order"),
    limit: (...args: unknown[]) => {
      entry.filters.limit = args;
      return Promise.resolve({ data: rows, error: null });
    },
  });
  return chain;
}

let rowsToReturn: unknown[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeChain(table, rowsToReturn) },
}));
vi.mock("@/infra/supabase", () => ({
  supabase: { from: (table: string) => makeChain(table, rowsToReturn) },
}));

import { getCurrentObraEtapa } from "../journey.repository";

const PROJECT_ID = "5c79098d-0ef0-4b91-91e2-3314313f899f";

describe("getCurrentObraEtapa", () => {
  beforeEach(() => {
    calls.length = 0;
    rowsToReturn = [];
  });

  it("lê o cronograma vivo (project_activities), nunca a tabela legada", async () => {
    rowsToReturn = [
      {
        description: "Demolição",
        etapa: "Obra bruta",
        planned_end: "2026-09-20",
        actual_end: null,
      },
    ];

    await getCurrentObraEtapa(PROJECT_ID);

    expect(calls.map((c) => c.table)).toEqual(["project_activities"]);
    expect(calls[0].table).not.toBe("atividades");
    // Atividade atual = ainda não concluída, pela data prevista de fim.
    expect(calls[0].filters.eq).toEqual(["project_id", PROJECT_ID]);
    expect(calls[0].filters.is).toEqual(["actual_end", null]);
  });

  it("prefere a etapa; cai para a descrição quando a etapa está vazia", async () => {
    rowsToReturn = [
      { description: "Demolição", etapa: "Obra bruta", actual_end: null },
    ];
    expect(await getCurrentObraEtapa(PROJECT_ID)).toBe("Obra bruta");

    calls.length = 0;
    rowsToReturn = [{ description: "Demolição", etapa: null, actual_end: null }];
    expect(await getCurrentObraEtapa(PROJECT_ID)).toBe("Demolição");
  });

  it("obra sem atividade em aberto devolve null", async () => {
    rowsToReturn = [];
    expect(await getCurrentObraEtapa(PROJECT_ID)).toBeNull();
  });
});
