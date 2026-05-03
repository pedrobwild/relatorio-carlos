import { describe, expect, it } from "vitest";
import { classifyDomain } from "../domainClassifier";

describe("classifyDomain", () => {
  it("identifies financial questions", () => {
    expect(classifyDomain("quais pagamentos estão vencidos?").domain).toBe("financeiro");
    expect(classifyDomain("quanto recebemos este mês?").domain).toBe("financeiro");
    expect(classifyDomain("Total de boletos pagos").domain).toBe("financeiro");
  });

  it("identifies purchase questions", () => {
    expect(classifyDomain("quais compras estão atrasadas?").domain).toBe("compras");
    expect(classifyDomain("compras com lead time alto").domain).toBe("compras");
  });

  it("identifies schedule questions", () => {
    expect(classifyDomain("quais atividades estão atrasadas?").domain).toBe("cronograma");
    expect(classifyDomain("etapa de fundação no cronograma").domain).toBe("cronograma");
  });

  it("identifies NC questions", () => {
    expect(classifyDomain("Quais NCs críticas estão abertas?").domain).toBe("ncs");
    expect(classifyDomain("Não-conformidades por obra").domain).toBe("ncs");
  });

  it("identifies pendencias", () => {
    expect(classifyDomain("Pendências do cliente vencidas").domain).toBe("pendencias");
  });

  it("identifies CS", () => {
    expect(classifyDomain("Tickets críticos abertos no atendimento").domain).toBe("cs");
  });

  it("flags executive questions", () => {
    const r = classifyDomain("O que eu preciso priorizar hoje?");
    expect(r.isExecutive).toBe(true);
    expect(r.domain).toBe("obras");
  });

  it("falls back to outros for unrelated text", () => {
    expect(classifyDomain("blablabla").domain).toBe("outros");
  });
});
