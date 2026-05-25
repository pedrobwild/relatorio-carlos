import { describe, it, expect } from "vitest";
import {
  generateCronogramaPdf,
  CronogramaPdfEmptyError,
  slugifyForFilename,
  type CronogramaPdfProject,
} from "../cronogramaPdf";
import type { ProjectActivity } from "@/hooks/useProjectActivities";

const baseProject: CronogramaPdfProject = {
  id: "p-1",
  name: "Apto Itaim Jardim",
  customer_name: "Carlos Pereira",
  address: "Rua das Flores, 123",
  bairro: "Itaim Bibi",
  cidade: "São Paulo",
};

const fixedNow = new Date(2026, 4, 24, 10, 0, 0); // 2026-05-24 10:00 local

function makeActivity(
  overrides: Partial<ProjectActivity> = {},
): ProjectActivity {
  return {
    id: overrides.id ?? "a-1",
    project_id: "p-1",
    description: "Mobilização e alinhamentos",
    planned_start: "2026-06-01",
    planned_end: "2026-06-05",
    actual_start: null,
    actual_end: null,
    weight: 10,
    sort_order: 0,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    created_by: "u-1",
    predecessor_ids: [],
    baseline_start: null,
    baseline_end: null,
    baseline_saved_at: null,
    etapa: null,
    detailed_description: null,
    ...overrides,
  };
}

describe("slugifyForFilename", () => {
  it("normaliza acentos e espaços", () => {
    expect(slugifyForFilename("Apto Itaim Jardim")).toBe("apto-itaim-jardim");
    expect(slugifyForFilename("Obra São João — Centro!")).toBe(
      "obra-sao-joao-centro",
    );
  });

  it("retorna fallback para entrada vazia", () => {
    expect(slugifyForFilename("")).toBe("obra");
    expect(slugifyForFilename(null)).toBe("obra");
    expect(slugifyForFilename(undefined)).toBe("obra");
  });
});

describe("generateCronogramaPdf", () => {
  it("lança CronogramaPdfEmptyError quando não há atividades", async () => {
    await expect(generateCronogramaPdf(baseProject, [])).rejects.toBeInstanceOf(
      CronogramaPdfEmptyError,
    );
  });

  it("gera PDF para obra não iniciada e produz blob válido", async () => {
    const activities = [
      makeActivity({
        id: "a-1",
        description: "Demolição",
        planned_start: "2026-06-01",
        planned_end: "2026-06-05",
        weight: 30,
        etapa: "Estrutura",
        sort_order: 0,
      }),
      makeActivity({
        id: "a-2",
        description: "Alvenaria",
        planned_start: "2026-06-08",
        planned_end: "2026-06-19",
        weight: 70,
        etapa: "Estrutura",
        sort_order: 1,
      }),
    ];

    const { doc, fileName } = await generateCronogramaPdf(
      baseProject,
      activities,
      { now: fixedNow },
    );

    expect(fileName).toBe("cronograma_apto-itaim-jardim_2026-05-24.pdf");
    const blob = doc.output("blob");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });

  it("gera PDF para obra em andamento (com actual_start) sem erros", async () => {
    const activities = [
      makeActivity({
        id: "a-1",
        description: "Fundação",
        planned_start: "2026-04-01",
        planned_end: "2026-04-20",
        actual_start: "2026-04-01",
        actual_end: "2026-04-22",
        weight: 50,
        sort_order: 0,
      }),
      makeActivity({
        id: "a-2",
        description: "Alvenaria",
        planned_start: "2026-05-01",
        planned_end: "2026-05-20",
        actual_start: "2026-05-05",
        weight: 50,
        sort_order: 1,
      }),
    ];

    const { doc, fileName } = await generateCronogramaPdf(
      baseProject,
      activities,
      { now: fixedNow },
    );

    expect(fileName).toMatch(/^cronograma_apto-itaim-jardim_2026-05-24\.pdf$/);
    const blob = doc.output("blob");
    expect(blob.size).toBeGreaterThan(500);
  });

  it("gera PDF com atividade atrasada (linha em destaque) sem erros", async () => {
    const activities = [
      makeActivity({
        id: "a-1",
        description: "Demolição (em atraso)",
        planned_start: "2026-04-01",
        planned_end: "2026-04-15",
        actual_start: "2026-04-01",
        actual_end: null,
        weight: 100,
        sort_order: 0,
      }),
    ];

    const { doc } = await generateCronogramaPdf(baseProject, activities, {
      now: fixedNow,
    });

    const blob = doc.output("blob");
    expect(blob.size).toBeGreaterThan(500);
  });

  it("respeita o nome de arquivo customizado", async () => {
    const activities = [makeActivity()];
    const { fileName } = await generateCronogramaPdf(baseProject, activities, {
      now: fixedNow,
      fileName: "cronograma_custom.pdf",
    });
    expect(fileName).toBe("cronograma_custom.pdf");
  });
});
