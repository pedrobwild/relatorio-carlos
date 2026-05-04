/**
 * Snapshot de regressão do rótulo "Execução - S{N}".
 *
 * Garante que, para um conjunto fixo de pares (inicio_etapa, hoje), o rótulo
 * gerado por `formatEtapaLabel` permaneça idêntico no tempo. Qualquer
 * alteração intencional na fórmula da semana exige atualizar o snapshot
 * via `vitest -u` e revisar conscientemente as diferenças.
 */
import { describe, it, expect } from "vitest";
import { formatEtapaLabel } from "../painelEtapaWeek";

interface Caso {
  inicio_etapa: string;
  now: string; // YYYY-MM-DD HH:mm (local)
}

const exec = (inicio_etapa: string) => ({
  etapa: "Execução" as const,
  inicio_etapa,
  inicio_oficial: null,
});

const parseLocal = (s: string): Date => {
  // 'YYYY-MM-DD HH:mm' → Date local
  const [d, t = "00:00"] = s.split(" ");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return new Date(y, mo - 1, da, h, mi, 0);
};

describe("formatEtapaLabel — snapshot de rótulos por data", () => {
  it("mantém rótulos consistentes para casos de referência", () => {
    const casos: Caso[] = [
      // Cenário do enunciado original: começou 01/04, hoje 29/04 → S5
      { inicio_etapa: "2026-04-01", now: "2026-04-29 09:00" },
      // Borda do dia 7 → S1
      { inicio_etapa: "2026-04-01", now: "2026-04-07 23:59" },
      // Virada para S2
      { inicio_etapa: "2026-04-01", now: "2026-04-08 00:00" },
      // Múltiplas semanas
      { inicio_etapa: "2026-04-01", now: "2026-04-15 12:00" }, // S3
      { inicio_etapa: "2026-04-01", now: "2026-04-22 12:00" }, // S4
      { inicio_etapa: "2026-04-01", now: "2026-06-03 08:00" }, // S10
      { inicio_etapa: "2026-04-01", now: "2026-09-30 23:00" }, // ~S27
      // Antes do início → S1 (clamp)
      { inicio_etapa: "2026-04-01", now: "2026-03-25 10:00" },
      // Início no mesmo dia
      { inicio_etapa: "2026-04-01", now: "2026-04-01 00:00" },
      // Mudança de mês
      { inicio_etapa: "2026-01-15", now: "2026-02-12 10:00" }, // S5
      // Ano bissexto (2024)
      { inicio_etapa: "2024-02-01", now: "2024-03-07 10:00" }, // S6
      // Virada de ano
      { inicio_etapa: "2025-12-20", now: "2026-01-10 10:00" }, // S4
    ];

    const snapshot = casos.map((c) => ({
      inicio_etapa: c.inicio_etapa,
      now: c.now,
      label: formatEtapaLabel(exec(c.inicio_etapa), parseLocal(c.now)),
    }));

    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S5",
          "now": "2026-04-29 09:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S1",
          "now": "2026-04-07 23:59",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S2",
          "now": "2026-04-08 00:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S3",
          "now": "2026-04-15 12:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S4",
          "now": "2026-04-22 12:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S10",
          "now": "2026-06-03 08:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S27",
          "now": "2026-09-30 23:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S1",
          "now": "2026-03-25 10:00",
        },
        {
          "inicio_etapa": "2026-04-01",
          "label": "Execução - S1",
          "now": "2026-04-01 00:00",
        },
        {
          "inicio_etapa": "2026-01-15",
          "label": "Execução - S5",
          "now": "2026-02-12 10:00",
        },
        {
          "inicio_etapa": "2024-02-01",
          "label": "Execução - S6",
          "now": "2024-03-07 10:00",
        },
        {
          "inicio_etapa": "2025-12-20",
          "label": "Execução - S4",
          "now": "2026-01-10 10:00",
        },
      ]
    `);
  });

  it("mantém rótulos para etapas não-Execução (sem sufixo S{N})", () => {
    const now = new Date(2026, 3, 29);
    const etapas = [
      "Medição",
      "Executivo",
      "Emissão RRT",
      "Condomínio",
      "Planejamento",
      "Mobilização",
      "Vistoria",
      "Vistoria reprovada",
      "Finalizada",
    ] as const;
    const snapshot = etapas.map((etapa) => ({
      etapa,
      label: formatEtapaLabel(
        { etapa, inicio_etapa: "2026-04-01", inicio_oficial: null },
        now,
      ),
    }));

    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "etapa": "Medição",
          "label": "Medição",
        },
        {
          "etapa": "Executivo",
          "label": "Executivo",
        },
        {
          "etapa": "Emissão RRT",
          "label": "Emissão RRT",
        },
        {
          "etapa": "Condomínio",
          "label": "Condomínio",
        },
        {
          "etapa": "Planejamento",
          "label": "Planejamento",
        },
        {
          "etapa": "Mobilização",
          "label": "Mobilização",
        },
        {
          "etapa": "Vistoria",
          "label": "Vistoria",
        },
        {
          "etapa": "Vistoria reprovada",
          "label": "Vistoria reprovada",
        },
        {
          "etapa": "Finalizada",
          "label": "Finalizada",
        },
      ]
    `);
  });
});
