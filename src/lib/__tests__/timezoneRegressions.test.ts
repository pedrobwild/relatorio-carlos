/**
 * Regressões de fuso: às 22h30 em São Paulo (UTC-3) o "hoje" em UTC já é o
 * dia seguinte, e uma data `YYYY-MM-DD` lida como UTC aparece como a véspera.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTaskOverdue } from "@/lib/taskUtils";
import { fmtDateBR } from "@/lib/assistant/resultInterpreter";
import { subtractBusinessDays } from "@/lib/businessDays";
import { toLocalISODate } from "@/lib/localDate";

describe("regressões de fuso (22h30 local)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Domingo, 11/10/2026, 22:30 no fuso local.
    vi.setSystemTime(new Date(2026, 9, 11, 22, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isTaskOverdue: tarefa que vence hoje não está atrasada", () => {
    expect(isTaskOverdue({ due_date: "2026-10-11", status: "pendente" })).toBe(
      false,
    );
    expect(isTaskOverdue({ due_date: "2026-10-10", status: "pendente" })).toBe(
      true,
    );
    expect(isTaskOverdue({ due_date: "2026-10-10", status: "concluido" })).toBe(
      false,
    );
  });

  it("fmtDateBR: data sem hora mantém o dia do calendário", () => {
    expect(fmtDateBR("2026-04-30")).toBe("30/04/2026");
  });

  it("subtractBusinessDays: anda para trás pulando fim de semana e feriado", () => {
    // Domingo 11/10 recua para sexta 09/10; 5 dias úteis antes = sexta 02/10.
    expect(toLocalISODate(subtractBusinessDays(new Date(), 5))).toBe(
      "2026-10-02",
    );
    // Terça 13/10 − 1 dia útil pula o feriado de 12/10 e o fim de semana.
    expect(
      toLocalISODate(subtractBusinessDays(new Date(2026, 9, 13, 22, 30), 1)),
    ).toBe("2026-10-09");
    // n = 0 em dia útil devolve o próprio dia, à meia-noite local.
    const same = subtractBusinessDays(new Date(2026, 9, 14, 22, 30), 0);
    expect(toLocalISODate(same)).toBe("2026-10-14");
    expect(same.getHours()).toBe(0);
  });
});
