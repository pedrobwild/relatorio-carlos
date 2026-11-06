import { describe, it, expect } from "vitest";
import models from "@/data/weeklyScheduleModels.json";
import {
  buildCalendarWeeks,
  buildWeeklyRows,
  computeSlack,
  contractEndDate,
  generateWeeklyPlan,
  SLACK_DESCRIPTION,
  type ScheduleModel,
  type WeeklyTemplateActivity,
} from "../weeklySchedule";
import { evaluateShowIf, validateShowIf } from "../showIf";

const m5560 = models[0];
const model = m5560.schedule_model as ScheduleModel;
const acts = m5560.default_activities as WeeklyTemplateActivity[];
const start = new Date(2026, 10, 16); // 16/11/2026
const conditions = { bancada: "Nova", marcenaria: "Sim", demolicao: "Não" };

describe("showIf", () => {
  it("avalia igual, diferente e &", () => {
    expect(evaluateShowIf("bancada!=Não tem", conditions)).toBe(true);
    expect(evaluateShowIf("demolicao=Sim", conditions)).toBe(false);
    expect(evaluateShowIf("marcenaria=Sim&bancada=Nova", conditions)).toBe(true);
    expect(evaluateShowIf("marcenaria=Sim&bancada=Troca", conditions)).toBe(false);
    expect(evaluateShowIf(undefined, conditions)).toBe(true);
  });
  it("valida contra os campos do template", () => {
    expect(validateShowIf("forro=Sim", m5560.custom_fields)).toHaveLength(1);
    expect(validateShowIf("bancada=Talvez", m5560.custom_fields)).toHaveLength(1);
    expect(validateShowIf("bancada!=Não tem", m5560.custom_fields)).toHaveLength(0);
  });
});

describe("semanas de calendário", () => {
  it("semana 1 de 16 a 20/11 com 4 dias úteis (20/11 feriado)", () => {
    const [w1] = buildCalendarWeeks(start, 1);
    expect(w1.calStart.getDate()).toBe(16);
    expect(w1.calEnd.getDate()).toBe(20);
    expect(w1.businessDays).toBe(4);
    expect(w1.holidays).toEqual(["2026-11-20"]);
  });
  it("semana 1 com menos de 3 dias úteis vai até a sexta seguinte", () => {
    const [w1, w2] = buildCalendarWeeks(new Date(2026, 10, 19), 2); // quinta
    expect(w1.calEnd.getDate()).toBe(27);
    expect(w1.businessDays).toBe(6); // 19 + 23..27
    expect(w2.calStart.getDate()).toBe(30);
  });
});

describe("caso de aceite 55/60", () => {
  it("fim pelo contrato 15/02/2027", () => {
    const end = contractEndDate(start, 60);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(15);
  });

  it("sem folga: última semana 01/02 a 05/02/2027", () => {
    const plan = generateWeeklyPlan(model, acts, {
      start,
      contractBusinessDays: 60,
      useSlack: false,
      conditions,
    });
    expect(plan.weeks).toHaveLength(12);
    expect(plan.slackAvailable).toBe(1);
    expect(plan.weeks[11].calStart).toBe("2027-02-01");
    expect(plan.weeks[11].calEnd).toBe("2027-02-05");
    expect(plan.alerts).toHaveLength(0);
  });

  it("com folga: semana 12 vira folga e entrega 08 a 12/02 com 3 dias úteis", () => {
    const plan = generateWeeklyPlan(model, acts, {
      start,
      contractBusinessDays: 60,
      useSlack: true,
      conditions,
    });
    expect(plan.weeks).toHaveLength(13);
    expect(plan.weeks[11].isSlack).toBe(true);
    expect(plan.weeks[11].calStart).toBe("2027-02-01");
    expect(plan.weeks[12].calStart).toBe("2027-02-08");
    expect(plan.weeks[12].calEnd).toBe("2027-02-12");
    expect(plan.weeks[12].businessDays).toBe(3);
    const rows = buildWeeklyRows(plan);
    expect(rows.client[11].description).toBe(SLACK_DESCRIPTION);
    expect(rows.client[12].description).toBe("Limpeza e entrega das chaves");
    expect(rows.client[12].planned_start).toBe("2027-02-10");
    expect(plan.delivery).toBe("2027-02-12");
  });

  it("semana 2 traz as três medições como marcos internos", () => {
    const plan = generateWeeklyPlan(model, acts, {
      start,
      contractBusinessDays: 60,
      useSlack: true,
      conditions,
    });
    const marcos = plan.items
      .filter((i) => i.week === 2 && i.kind === "marco")
      .map((i) => i.description);
    expect(marcos).toEqual([
      "Medição das bancadas",
      "Medição da marcenaria",
      "Medição do box",
    ]);
    const rows = buildWeeklyRows(plan);
    expect(rows.client[1].description).not.toContain("Medição");
    expect(rows.client[1].description).not.toContain("Demolições");
  });

  it("pesos iguais somando 100 e uma linha por semana", () => {
    const plan = generateWeeklyPlan(model, acts, {
      start,
      contractBusinessDays: 60,
      useSlack: true,
      conditions,
    });
    const rows = buildWeeklyRows(plan);
    expect(rows.client).toHaveLength(13);
    const sum = rows.client.reduce((s, r) => s + r.weight, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    expect(rows.client[0].etapa).toBe("Semana 1");
  });
});

describe("folga e alertas", () => {
  it("sem espaço no contrato não há folga", () => {
    expect(computeSlack(start, 12, contractEndDate(start, 55))).toBe(0);
  });
  it("prazo curto gera alerta de estouro com dias úteis", () => {
    const plan = generateWeeklyPlan(model, acts, {
      start,
      contractBusinessDays: 50,
      useSlack: true,
      conditions,
    });
    const overrun = plan.alerts.find((a) => a.kind === "overrun");
    expect(overrun?.blocking).toBe(true);
    expect(overrun?.message).toMatch(/\d+ dias úteis/);
  });
});

describe("cartão de entrega", async () => {
  const { deliveryDiff } = await import("@/pages/nova-obra/WeeklySchedulePreview");
  it("com folga sobra 1 dia útil até 15/02/2027", () => {
    expect(deliveryDiff("2027-02-12", "2027-02-15")).toBe(1);
  });
  it("passa do contrato fica negativo", () => {
    expect(deliveryDiff("2027-02-16", "2027-02-15")).toBe(-1);
  });
});
