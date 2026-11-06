import { describe, it, expect } from "vitest";
import models from "@/data/weeklyScheduleModels.json";
import {
  generateWeeklyPlan,
  type ScheduleModel,
  type WeeklyTemplateActivity,
} from "../weeklySchedule";
import {
  buildWeeklyPurchases,
  computePurchaseDates,
  purchaseDeadlineState,
  isAboveBudget,
  isBuyThisWeek,
  similarityScore,
} from "../weeklyPurchases";

const m = models[0];
const plan = generateWeeklyPlan(
  m.schedule_model as ScheduleModel,
  m.default_activities as WeeklyTemplateActivity[],
  {
    start: new Date(2026, 10, 16),
    contractBusinessDays: 60,
    useSlack: true,
    conditions: { bancada: "Nova", marcenaria: "Sim", demolicao: "Não" },
  },
);
const purchases = buildWeeklyPurchases(plan);
const br = (iso: string) => iso.split("-").reverse().join("/");

// [compra, semana, precisa ("marco" = no marco), ideal, limite]
const TABLE: [string, number, string, string, string][] = [
  ["Material de infraestrutura", 1, "16/11/2026", "30/10/2026", "09/11/2026"],
  ["Tubulação e material de ar-condicionado", 2, "23/11/2026", "09/11/2026", "16/11/2026"],
  ["Material elétrico", 2, "23/11/2026", "09/11/2026", "16/11/2026"],
  ["Fechadura eletrônica", 2, "23/11/2026", "09/11/2026", "16/11/2026"],
  ["Bancada de mármore", 2, "marco", "23/11/2026", "23/11/2026"],
  ["Box", 2, "marco", "23/11/2026", "23/11/2026"],
  ["Revestimentos", 3, "30/11/2026", "16/11/2026", "23/11/2026"],
  ["Tinta", 3, "30/11/2026", "16/11/2026", "23/11/2026"],
  ["Marcenaria", 3, "marco", "30/11/2026", "30/11/2026"],
  ["Piso vinílico", 4, "07/12/2026", "23/11/2026", "30/11/2026"],
  ["Material de nivelamento", 4, "07/12/2026", "23/11/2026", "30/11/2026"],
  ["Luminárias", 5, "14/12/2026", "30/11/2026", "07/12/2026"],
  ["Louças", 5, "14/12/2026", "30/11/2026", "07/12/2026"],
  ["Metais", 5, "14/12/2026", "30/11/2026", "07/12/2026"],
  ["Acessórios de banheiro", 5, "14/12/2026", "30/11/2026", "07/12/2026"],
  ["Cuba", 6, "07/12/2026", "23/11/2026", "30/11/2026"],
  ["Cooktop", 6, "21/12/2026", "07/12/2026", "14/12/2026"],
  ["Rodapés", 8, "04/01/2027", "21/12/2026", "28/12/2026"],
  ["Equipamento de ar-condicionado", 8, "04/01/2027", "21/12/2026", "28/12/2026"],
  ["Espelhos", 9, "11/01/2027", "18/12/2026", "24/12/2026"],
  ["Suporte de TV", 9, "11/01/2027", "21/12/2026", "28/12/2026"],
  ["Eletrodomésticos", 10, "18/01/2027", "28/12/2026", "04/01/2027"],
  ["Mobiliário solto", 10, "18/01/2027", "28/12/2026", "04/01/2027"],
  ["Cortina", 11, "26/01/2027", "18/12/2026", "24/12/2026"],
  ["Enxoval", 11, "26/01/2027", "05/01/2027", "12/01/2027"],
  ["Utensílios", 11, "26/01/2027", "05/01/2027", "12/01/2027"],
];

describe("compras do Exemplo A (55/60, 16/11/2026, com folga)", () => {
  it("gera exatamente 26 compras", () => {
    expect(purchases).toHaveLength(26);
  });

  it.each(TABLE)("%s", (name, week, precisa, ideal, limite) => {
    const p = purchases.find((x) => x.item_name === name)!;
    expect(p).toBeDefined();
    expect(p.weekIndex).toBe(week);
    if (precisa !== "marco") expect(br(p.dates.precisa)).toBe(precisa);
    expect(br(p.dates.ideal)).toBe(ideal);
    expect(br(p.dates.limite)).toBe(limite);
  });

  it("marcenaria: entrega 28/12/2026 no dia da montagem, com alerta", () => {
    const p = purchases.find((x) => x.item_name === "Marcenaria")!;
    expect(br(p.dates.expected!)).toBe("28/12/2026");
    expect(p.dates.alert).toContain("montagem");
  });

  it("box: medição 21 dias antes da instalação, sem alerta", () => {
    const p = purchases.find((x) => x.item_name === "Box")!;
    expect(p.refWeekIndex).toBe(5);
    expect(p.dates.alert).toBeNull();
  });

  it("cortina: agendar instalação até 19/01/2027", () => {
    const p = purchases.find((x) => x.item_name === "Cortina")!;
    expect(br(p.dates.reminder!)).toBe("19/01/2027");
  });

  it("cuba entregue na marmoraria", () => {
    const p = purchases.find((x) => x.item_name === "Cuba")!;
    expect(p.delivery_location).toBe("fornecedor");
  });

  it("prazo a confirmar marcado nos itens do JSON", () => {
    const names = purchases.filter((p) => p.rule.prazo_confirmar).map((p) => p.item_name);
    expect(names).toEqual(
      expect.arrayContaining(["Equipamento de ar-condicionado", "Suporte de TV", "Enxoval"]),
    );
  });
});

describe("recalcular", () => {
  it("semana 3 uma semana à frente move as compras da semana", () => {
    const tinta = computePurchaseDates({ regra: "padrao" }, "2026-12-07");
    expect(br(tinta.ideal)).toBe("23/11/2026");
    expect(br(tinta.limite)).toBe("30/11/2026");
  });
  it("prazo confirmado: limite = precisa − prazo; ideal = limite − 7", () => {
    const d = computePurchaseDates({ regra: "padrao", prazo_confirmar: true }, "2027-01-04", null, {
      days: 21,
      confirmed: true,
    });
    expect(br(d.limite)).toBe("14/12/2026");
    expect(br(d.ideal)).toBe("07/12/2026");
  });
});

describe("alertas de prazo", () => {
  const base = { status: "pending", planned_purchase_date: "2026-11-16", purchase_deadline_date: "2026-11-23" };
  it("amarelo depois do ideal, vermelho depois do limite", () => {
    expect(purchaseDeadlineState(base, "2026-11-16")).toBe("ok");
    expect(purchaseDeadlineState(base, "2026-11-17")).toBe("late_ideal");
    expect(purchaseDeadlineState(base, "2026-11-24")).toBe("late_deadline");
    expect(purchaseDeadlineState({ ...base, status: "purchased" }, "2026-12-01")).toBe("ok");
  });
});

describe("prazo do fornecedor informado", () => {
  it("10 dias úteis: limite = precisa − 10 dias úteis; ideal = limite − 7 (dia útil anterior)", () => {
    // Equipamento de ar-condicionado: precisa 04/01/2027
    const d = computePurchaseDates({ regra: "padrao", prazo_confirmar: true }, "2027-01-04", null, {
      days: 10,
      confirmed: true,
    });
    expect(br(d.limite)).toBe("17/12/2026");
    expect(br(d.ideal)).toBe("10/12/2026");
  });
});

describe("comprar esta semana", () => {
  const today = "2026-11-18"; // quarta; semana 16 a 22/11
  const p = (status: string, ideal: string | null, limite: string | null) => ({
    status,
    planned_purchase_date: ideal,
    purchase_deadline_date: limite,
  });
  it("inclui ideal ou limite na semana e vencidos, só pendentes", () => {
    expect(isBuyThisWeek(p("pending", "2026-11-22", "2026-11-30"), today)).toBe(true);
    expect(isBuyThisWeek(p("pending", "2026-11-30", "2026-11-20"), today)).toBe(true);
    expect(isBuyThisWeek(p("pending", "2026-11-01", "2026-11-09"), today)).toBe(true);
    expect(isBuyThisWeek(p("pending", "2026-11-23", "2026-11-30"), today)).toBe(false);
    expect(isBuyThisWeek(p("purchased", "2026-11-17", "2026-11-18"), today)).toBe(false);
  });
});

describe("valor orçado", () => {
  it("custo real acima do orçado", () => {
    expect(isAboveBudget(1200, 1000)).toBe(true);
    expect(isAboveBudget(1000, 1000)).toBe(false);
    expect(isAboveBudget(null, 1000)).toBe(false);
  });
  it("ordena por semelhança de nome", () => {
    const c = { item_name: "Piso vinílico", category: "Revestimentos e piso" };
    expect(similarityScore(c, { name: "Piso vinílico click 5mm" })).toBeGreaterThan(
      similarityScore(c, { name: "Tinta acrílica" }),
    );
  });
});
