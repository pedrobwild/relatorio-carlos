import { describe, it, expect } from "vitest";
import { relatorioSemanaStatus } from "@/lib/relatorioSemanaStatus";

const HOJE = "2026-11-10";
const obra = { inicio: "2026-10-01", fim: "2026-12-18" };
const semana = (p: Record<string, unknown> = {}) => ({
  periodStart: "2026-11-09",
  periodEnd: "2026-11-15",
  executiveSummary: "",
  gallery: [],
  ...p,
});

describe("relatorioSemanaStatus", () => {
  it("carregando ou com erro: neutro, sem afirmar nada", () => {
    expect(relatorioSemanaStatus({ reports: [semana({ executiveSummary: "x" })], loaded: false, hoje: HOJE, obra })).toEqual({
      kind: "neutro",
    });
  });

  it("relatório da semana de hoje com conteúdo: rascunho com a contagem de fotos", () => {
    expect(
      relatorioSemanaStatus({
        reports: [semana({ gallery: [{ id: "a" }, { id: "b" }] })],
        loaded: true,
        hoje: HOJE,
        obra,
      }),
    ).toEqual({ kind: "rascunho", fotos: 2 });
    expect(
      relatorioSemanaStatus({ reports: [semana({ executiveSummary: "Pintura iniciada." })], loaded: true, hoje: HOJE, obra }),
    ).toEqual({ kind: "rascunho", fotos: 0 });
  });

  it("relatório de outra semana não conta para a semana de hoje", () => {
    const passada = semana({ periodStart: "2026-11-02", periodEnd: "2026-11-08", executiveSummary: "x" });
    expect(relatorioSemanaStatus({ reports: [passada], loaded: true, hoje: HOJE, obra })).toEqual({ kind: "sem_relatorio" });
  });

  it("linha vazia da semana conta como sem relatório", () => {
    expect(relatorioSemanaStatus({ reports: [semana()], loaded: true, hoje: HOJE, obra })).toEqual({ kind: "sem_relatorio" });
  });

  it("obra fora do período ou sem datas: neutro", () => {
    expect(relatorioSemanaStatus({ reports: [], loaded: true, hoje: HOJE, obra: { inicio: "2026-08-01", fim: "2026-10-30" } })).toEqual({
      kind: "neutro",
    });
    expect(relatorioSemanaStatus({ reports: [], loaded: true, hoje: HOJE, obra: {} })).toEqual({ kind: "neutro" });
  });

  it("período em formato desconhecido é ignorado", () => {
    const estranho = semana({ periodStart: "09/11/2026", periodEnd: "15/11/2026", executiveSummary: "x" });
    expect(relatorioSemanaStatus({ reports: [estranho], loaded: true, hoje: HOJE, obra })).toEqual({ kind: "sem_relatorio" });
  });
});
