import { describe, expect, it } from "vitest";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import {
  attachDeadlines,
  compareByFolga,
  contractLateDays,
  effectiveDeadline,
  isPrazoEmRisco,
  obraPrazoHealth,
  sumAccruedPenalty,
} from "../painelPrazo";

const dl = (p: Partial<ProjectDeadline>): ProjectDeadline =>
  ({
    project_id: "p",
    current_deadline: "2026-11-27",
    contract_deadline: "2026-11-27",
    current_business_days: 60,
    business_days_remaining: 30,
    business_days_late: 0,
    penalty_accrued_value: null,
    ...p,
  }) as ProjectDeadline;

const obra = (over: Partial<{ entrega_oficial: string | null; entrega_real: string | null; prazo_contratual: ProjectDeadline | null }> = {}) => ({
  entrega_oficial: "2026-12-15",
  entrega_real: null,
  prazo_contratual: null,
  ...over,
});

describe("attachDeadlines", () => {
  it("anexa por id e deixa null quando a obra não tem prazo", () => {
    const out = attachDeadlines([{ id: "a" }, { id: "b" }], [dl({ project_id: "a" })]);
    expect(out[0].prazo_contratual?.project_id).toBe("a");
    expect(out[1].prazo_contratual).toBeNull();
  });
  it("lista indefinida (carregando) = sem prazo para todas", () => {
    expect(attachDeadlines([{ id: "a" }], undefined)[0].prazo_contratual).toBeNull();
  });
});

describe("effectiveDeadline", () => {
  it("contrato manda sobre a entrega oficial (que é editável)", () => {
    expect(effectiveDeadline(obra({ prazo_contratual: dl({ current_deadline: "2026-11-27" }) }))).toBe("2026-11-27");
  });
  it("sem contrato, usa a entrega oficial", () => {
    expect(effectiveDeadline(obra())).toBe("2026-12-15");
  });
});

describe("contractLateDays", () => {
  it("null quando não há prazo contratual (Painel usa a regra antiga)", () => {
    expect(contractLateDays(obra())).toBeNull();
  });
  it("dias úteis de atraso vindos do banco", () => {
    expect(contractLateDays(obra({ prazo_contratual: dl({ business_days_remaining: -8, business_days_late: 8 }) }))).toBe(8);
  });
  it("obra entregue não acumula atraso no Painel", () => {
    expect(contractLateDays(obra({ entrega_real: "2026-12-01", prazo_contratual: dl({ business_days_late: 3 }) }))).toBe(0);
  });
});

describe("obraPrazoHealth / isPrazoEmRisco", () => {
  const today = "2026-10-11";
  const in7 = "2026-10-18";
  it("contrato: atenção com folga curta, mesmo que a entrega oficial esteja longe", () => {
    const o = obra({ entrega_oficial: "2027-01-30", prazo_contratual: dl({ business_days_remaining: 4 }) });
    expect(obraPrazoHealth(o)).toBe("atencao");
    expect(isPrazoEmRisco(o, today, in7)).toBe(true);
  });
  it("contrato: folga confortável não é risco", () => {
    expect(isPrazoEmRisco(obra({ prazo_contratual: dl({ business_days_remaining: 20 }) }), today, in7)).toBe(false);
  });
  it("atrasada não conta como risco (já está no indicador de atrasadas)", () => {
    const o = obra({ prazo_contratual: dl({ business_days_remaining: -2, business_days_late: 2 }) });
    expect(obraPrazoHealth(o)).toBe("atrasada");
    expect(isPrazoEmRisco(o, today, in7)).toBe(false);
  });
  it("sem contrato: mantém a regra antiga de 7 dias", () => {
    expect(isPrazoEmRisco(obra({ entrega_oficial: "2026-10-15" }), today, in7)).toBe(true);
    expect(isPrazoEmRisco(obra({ entrega_oficial: "2026-10-30" }), today, in7)).toBe(false);
    expect(obraPrazoHealth(obra())).toBe("sem_prazo");
  });
  it("obra entregue nunca está em risco", () => {
    expect(isPrazoEmRisco(obra({ entrega_real: "2026-10-01", prazo_contratual: dl({ business_days_remaining: 1 }) }), today, in7)).toBe(false);
  });
});

describe("sumAccruedPenalty / compareByFolga", () => {
  it("soma a multa acumulada", () => {
    expect(
      sumAccruedPenalty([
        obra({ prazo_contratual: dl({ penalty_accrued_value: 4000 }) }),
        obra({ prazo_contratual: dl({ penalty_accrued_value: 1500.5 }) }),
        obra(),
      ]),
    ).toBe(5500.5);
  });
  it("ordena: mais atrasada → menor folga → sem prazo → entregue", () => {
    const late = obra({ prazo_contratual: dl({ business_days_remaining: -10 }) });
    const tight = obra({ prazo_contratual: dl({ business_days_remaining: 3 }) });
    const ok = obra({ prazo_contratual: dl({ business_days_remaining: 40 }) });
    const none = obra();
    const done = obra({ entrega_real: "2026-09-01", prazo_contratual: dl({ business_days_remaining: -1 }) });
    const sorted = [done, ok, none, tight, late].sort(compareByFolga);
    expect(sorted).toEqual([late, tight, ok, none, done]);
  });
});
