import { describe, expect, it } from "vitest";
import {
  buscarObras,
  contarPorStatus,
  copiaAtrasada,
  haQuanto,
  nomeDaObraNoCompras,
  nomeDaObraNoWorkflow,
  obrasJaVinculadas,
} from "../comprasVinculo";
import type {
  ComprasObraVinculo,
  ObraWorkflowOpcao,
} from "@/infra/repositories/comprasSync.repository";

const obras: ObraWorkflowOpcao[] = [
  { id: "p1", name: "Itaim 112", unit_name: "112", customer_name: "Maria Silva" },
  { id: "p2", name: "Pinheiros 45", unit_name: null, customer_name: "João Araújo" },
];

const vinculo = (over: Partial<ComprasObraVinculo>): ComprasObraVinculo => ({
  id: "v1",
  chave: "maria silva|itaim|112",
  cliente: "Maria Silva",
  empreendimento: "Itaim",
  unidade: "112",
  project_id: null,
  status: "pendente",
  decidido_por_nome: null,
  decidido_em: null,
  ultima_vez_em: "2026-11-24T12:00:00Z",
  solicitacoes: 2,
  project: null,
  ...over,
});

describe("comprasVinculo", () => {
  it("monta os nomes das obras", () => {
    expect(nomeDaObraNoCompras(vinculo({}))).toBe("Maria Silva · Itaim · 112");
    expect(nomeDaObraNoCompras(vinculo({ empreendimento: null, unidade: null }))).toBe("Maria Silva");
    expect(nomeDaObraNoWorkflow(obras[0])).toBe("Itaim 112 · Unid. 112 · Maria Silva");
  });

  it("busca ignora acento e exige todas as palavras", () => {
    expect(buscarObras(obras, "araujo pinheiros").map((o) => o.id)).toEqual(["p2"]);
    expect(buscarObras(obras, "maria pinheiros")).toEqual([]);
    expect(buscarObras(obras, "  ")).toHaveLength(2);
  });

  it("sem busca, não escolhe nem reordena nada sozinho", () => {
    expect(buscarObras(obras, "")).toBe(obras);
  });

  it("conta por situação", () => {
    expect(
      contarPorStatus([
        vinculo({}),
        vinculo({ id: "v2", status: "confirmado", project_id: "p1" }),
        vinculo({ id: "v3", status: "ignorado" }),
        vinculo({ id: "v4" }),
      ]),
    ).toEqual({ pendente: 2, confirmado: 1, ignorado: 1 });
  });

  it("avisa quando a obra do Workflow já está vinculada a outra", () => {
    const lista = [vinculo({ id: "v2", status: "confirmado", project_id: "p1" })];
    expect(obrasJaVinculadas(lista).get("p1")).toBe("Maria Silva · Itaim · 112");
    expect(obrasJaVinculadas(lista, "v2").size).toBe(0);
  });

  it("diz há quanto tempo e se a cópia está velha", () => {
    const agora = new Date("2026-11-24T12:30:00Z");
    expect(haQuanto("2026-11-24T12:27:00Z", agora)).toBe("há 3 min");
    expect(haQuanto("2026-11-24T10:00:00Z", agora)).toBe("há 2 h");
    expect(haQuanto("2026-11-20T10:00:00Z", agora)).toBe("há 4 dias");
    expect(haQuanto(null, agora)).toBe("nunca");
    expect(copiaAtrasada("2026-11-24T12:27:00Z", agora)).toBe(false);
    expect(copiaAtrasada("2026-11-24T11:00:00Z", agora)).toBe(true);
    expect(copiaAtrasada(null, agora)).toBe(true);
  });
});
