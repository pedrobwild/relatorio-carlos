import { describe, it, expect } from "vitest";
import { getEtapaWeek, formatEtapaLabel } from "../painelEtapaWeek";

const exec = (start: string | null, inicio_oficial: string | null = null) => ({
  etapa: "Execução" as const,
  inicio_etapa: start,
  inicio_oficial,
});

describe("getEtapaWeek", () => {
  it("retorna null para etapas que não são Execução", () => {
    expect(
      getEtapaWeek({
        etapa: "Planejamento",
        inicio_etapa: "2026-04-01",
        inicio_oficial: null,
      }),
    ).toBeNull();
    expect(
      getEtapaWeek({
        etapa: "Finalizada",
        inicio_etapa: "2026-04-01",
        inicio_oficial: null,
      }),
    ).toBeNull();
    expect(
      getEtapaWeek({
        etapa: null,
        inicio_etapa: "2026-04-01",
        inicio_oficial: null,
      }),
    ).toBeNull();
  });

  it("retorna null quando não há data de início (etapa nem oficial)", () => {
    expect(getEtapaWeek(exec(null, null))).toBeNull();
  });

  it("retorna null para data inválida", () => {
    expect(getEtapaWeek(exec("not-a-date"))).toBeNull();
  });

  it("usa inicio_oficial como fallback quando inicio_etapa é null", () => {
    const now = new Date(2026, 3, 8); // 8/abr/2026
    expect(getEtapaWeek(exec(null, "2026-04-01"), now)).toBe(2);
  });

  it("S1 nos primeiros 7 dias (dias 0..6)", () => {
    const start = "2026-04-01";
    for (let d = 0; d <= 6; d++) {
      const now = new Date(2026, 3, 1 + d);
      expect(getEtapaWeek(exec(start), now)).toBe(1);
    }
  });

  it("avança a semana a cada 7 dias", () => {
    const start = "2026-04-01";
    const cases: Array<[Date, number]> = [
      [new Date(2026, 3, 1), 1], // dia 0
      [new Date(2026, 3, 7), 1], // dia 6
      [new Date(2026, 3, 8), 2], // dia 7  → S2
      [new Date(2026, 3, 14), 2], // dia 13
      [new Date(2026, 3, 15), 3], // dia 14 → S3
      [new Date(2026, 3, 21), 3], // dia 20
      [new Date(2026, 3, 22), 4], // dia 21 → S4
      [new Date(2026, 3, 29), 5], // dia 28 → S5 (cenário do enunciado)
      [new Date(2026, 5, 3), 10], // dia 63 → S10
    ];
    for (const [now, expected] of cases) {
      expect(getEtapaWeek(exec(start), now)).toBe(expected);
    }
  });

  it("clampa em S1 quando a data atual é anterior ao início", () => {
    const now = new Date(2026, 2, 25); // 25/mar/2026
    expect(getEtapaWeek(exec("2026-04-01"), now)).toBe(1);
  });

  it("ignora horário do dia (compara apenas a data civil)", () => {
    const start = "2026-04-01";
    const earlyMorning = new Date(2026, 3, 8, 0, 5, 0); // 00:05
    const lateNight = new Date(2026, 3, 8, 23, 55, 0); // 23:55
    expect(getEtapaWeek(exec(start), earlyMorning)).toBe(2);
    expect(getEtapaWeek(exec(start), lateNight)).toBe(2);
  });
});

describe("getEtapaWeek — bordas exatas em múltiplos de 7 dias", () => {
  const start = "2026-04-01"; // S1 começa em 1/abr/2026

  it("dia 6 → S1 e dia 7 → S2 (borda da 1ª semana)", () => {
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 7))).toBe(1);
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 8))).toBe(2);
  });

  it("dia 13 → S2 e dia 14 → S3 (borda da 2ª semana)", () => {
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 14))).toBe(2);
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 15))).toBe(3);
  });

  it("dia 20 → S3 e dia 21 → S4 (borda da 3ª semana)", () => {
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 21))).toBe(3);
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 22))).toBe(4);
  });

  it("dia 27 → S4 e dia 28 → S5 (borda da 4ª semana)", () => {
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 28))).toBe(4);
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 29))).toBe(5);
  });

  it("cada múltiplo exato de 7 dias inicia uma nova semana S{N+1}", () => {
    // Para n = 1..12: dia (7n - 1) é S{n} e dia (7n) é S{n+1}.
    for (let n = 1; n <= 12; n++) {
      const ultimoDiaSn = new Date(2026, 3, 1 + (7 * n - 1));
      const primeiroDiaSn1 = new Date(2026, 3, 1 + 7 * n);
      expect(
        getEtapaWeek(exec(start), ultimoDiaSn),
        `dia ${7 * n - 1} → S${n}`,
      ).toBe(n);
      expect(
        getEtapaWeek(exec(start), primeiroDiaSn1),
        `dia ${7 * n} → S${n + 1}`,
      ).toBe(n + 1);
    }
  });

  it("a borda do dia 7 não é afetada pelo horário (00:00 e 23:59 são S2)", () => {
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 8, 0, 0, 0))).toBe(2);
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 8, 23, 59, 59))).toBe(2);
  });

  it("borda atravessando mês (start no fim do mês)", () => {
    const s = "2026-04-25";
    expect(getEtapaWeek(exec(s), new Date(2026, 4, 1))).toBe(1); // dia 6
    expect(getEtapaWeek(exec(s), new Date(2026, 4, 2))).toBe(2); // dia 7
    expect(getEtapaWeek(exec(s), new Date(2026, 4, 9))).toBe(3); // dia 14
    expect(getEtapaWeek(exec(s), new Date(2026, 4, 16))).toBe(4); // dia 21
  });

  it("borda atravessando ano (start em dezembro)", () => {
    const s = "2025-12-25";
    expect(getEtapaWeek(exec(s), new Date(2026, 0, 1))).toBe(2); // dia 7
    expect(getEtapaWeek(exec(s), new Date(2026, 0, 8))).toBe(3); // dia 14
    expect(getEtapaWeek(exec(s), new Date(2026, 0, 15))).toBe(4); // dia 21
  });
});

describe("formatEtapaLabel", () => {
  it("devolve null quando obra não tem etapa", () => {
    expect(
      formatEtapaLabel({
        etapa: null,
        inicio_etapa: null,
        inicio_oficial: null,
      }),
    ).toBeNull();
  });

  it("devolve o nome puro para etapas que não são Execução", () => {
    expect(
      formatEtapaLabel({
        etapa: "Planejamento",
        inicio_etapa: "2026-04-01",
        inicio_oficial: null,
      }),
    ).toBe("Planejamento");
    expect(
      formatEtapaLabel({
        etapa: "Finalizada",
        inicio_etapa: null,
        inicio_oficial: null,
      }),
    ).toBe("Finalizada");
  });

  it('devolve "Execução" puro quando faltam datas', () => {
    expect(formatEtapaLabel(exec(null, null))).toBe("Execução");
  });

  it('formata "Execução - S{N}" conforme a semana', () => {
    const start = "2026-04-01";
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 1))).toBe(
      "Execução - S1",
    );
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 8))).toBe(
      "Execução - S2",
    );
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 29))).toBe(
      "Execução - S5",
    );
  });
});

describe("getEtapaWeek — estabilidade de fuso horário e horário do dia", () => {
  /**
   * `parseISO('YYYY-MM-DD')` interpreta a string como meia-noite local. Como
   * `getEtapaWeek` normaliza para a data civil local (Y/M/D) antes de calcular
   * a diferença em dias, o resultado deve ser idêntico para qualquer instante
   * do mesmo dia, em qualquer offset de fuso aplicado ao `now`.
   */
  it("todos os horários do mesmo dia retornam a mesma semana", () => {
    const start = "2026-04-01";
    // 8/abr/2026 = dia 7 desde 1/abr → S2
    const horarios: Array<[number, number, number]> = [
      [0, 0, 0],
      [3, 30, 0],
      [8, 15, 42],
      [12, 0, 0],
      [17, 45, 0],
      [23, 59, 59],
    ];
    const semanas = horarios.map(([h, m, s]) =>
      getEtapaWeek(exec(start), new Date(2026, 3, 8, h, m, s)),
    );
    expect(new Set(semanas).size).toBe(1);
    expect(semanas[0]).toBe(2);
  });

  it("virada de dia (23:59 → 00:00) avança exatamente uma semana quando cruza o múltiplo de 7", () => {
    const start = "2026-04-01";
    // 7/abr 23:59 → ainda S1 (dia 6)
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 7, 23, 59, 59))).toBe(1);
    // 8/abr 00:00 → S2 (dia 7)
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 8, 0, 0, 0))).toBe(2);
    // 8/abr 23:59 → ainda S2
    expect(getEtapaWeek(exec(start), new Date(2026, 3, 8, 23, 59, 59))).toBe(2);
  });

  it("é estável independentemente do offset de fuso embutido no Date", () => {
    const start = "2026-04-01";
    // Constrói o "mesmo instante civil" (8/abr/2026 12:00 local) a partir de
    // diferentes representações: ISO local, UTC, e timestamps deslocados em
    // ±12h. O cálculo deve sempre cair em S2 porque normaliza pela data civil
    // do `now` no fuso local — não pelo instante UTC bruto.
    const sameDay = new Date(2026, 3, 8, 12, 0, 0);
    // Aplica deslocamentos de até ±11h59 dentro do mesmo dia local
    const deslocamentos = [-11, -6, -1, 0, 1, 6, 11];
    for (const h of deslocamentos) {
      const d = new Date(sameDay);
      d.setHours(12 + h);
      expect(
        getEtapaWeek(exec(start), d),
        `horário ${d.toISOString()} deveria continuar em S2`,
      ).toBe(2);
    }
  });

  it("inicio_etapa em formato ISO completo (com TZ) é tratado como o mesmo dia civil", () => {
    // O input vem do banco como 'YYYY-MM-DD'. Mesmo se o caller enviar uma
    // string ISO completa, o cálculo deve ancorar no dia civil dessa data.
    const startVariants = [
      "2026-04-01",
      "2026-04-01T00:00:00",
      "2026-04-01T12:00:00",
      "2026-04-01T23:59:59",
    ];
    const now = new Date(2026, 3, 8, 9, 0, 0); // → S2
    const semanas = startVariants.map((s) => getEtapaWeek(exec(s), now));
    expect(new Set(semanas).size).toBe(1);
    expect(semanas[0]).toBe(2);
  });
});
