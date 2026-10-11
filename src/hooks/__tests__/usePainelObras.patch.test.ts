/**
 * patchToDbColumns — o início da etapa só é regravado quando a etapa muda.
 * Na edição em massa o mesmo patch vai para várias obras; as que já estavam
 * na etapa escolhida não podem perder o início (zera a contagem de semanas).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { patchToDbColumns } from "../usePainelObras";

describe("patchToDbColumns · início da etapa", () => {
  afterEach(() => vi.useRealTimers());

  it("etapa mudou: grava o início como hoje no dia local (mesmo às 22h30)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 22, 30));
    expect(patchToDbColumns({ etapa: "Execução" }, "Mobilização")).toEqual({
      painel_etapa: "Execução",
      painel_inicio_etapa: "2026-10-11",
    });
  });

  it("mesma etapa (edição em massa): mantém o início", () => {
    expect(patchToDbColumns({ etapa: "Execução" }, "Execução")).toEqual({ painel_etapa: "Execução" });
  });

  it("início informado no mesmo patch vence", () => {
    expect(patchToDbColumns({ etapa: "Execução", inicio_etapa: "2026-10-01" }, "Mobilização")).toEqual({
      painel_etapa: "Execução",
      painel_inicio_etapa: "2026-10-01",
    });
  });

  it("patch sem etapa não mexe no início", () => {
    expect(patchToDbColumns({ entrega_real: "2026-10-09" }, "Execução")).toEqual({ actual_end_date: "2026-10-09" });
  });
});
