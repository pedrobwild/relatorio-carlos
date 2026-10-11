import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import { PrazoContratualCell, prazoResumo } from "../PrazoContratualCell";

const dl = (p: Partial<ProjectDeadline>): ProjectDeadline =>
  ({
    project_id: "p",
    contract_business_days: 60,
    contract_deadline: "2026-11-27",
    current_deadline: "2026-11-27",
    current_business_days: 60,
    business_days_elapsed: 30,
    business_days_remaining: 30,
    business_days_late: 0,
    amendment_business_days: 0,
    amendments_pending: 0,
    penalty_accrued_value: null,
    contract_terms_confirmed: true,
    ...p,
  }) as ProjectDeadline;

const renderCell = (o: { entrega_oficial?: string | null; entrega_real?: string | null; prazo_contratual: ProjectDeadline | null }) =>
  render(
    <TooltipProvider>
      <PrazoContratualCell obra={{ entrega_oficial: o.entrega_oficial ?? null, entrega_real: o.entrega_real ?? null, prazo_contratual: o.prazo_contratual }} />
    </TooltipProvider>,
  );

describe("PrazoContratualCell", () => {
  it("no prazo: mostra folga e data", () => {
    renderCell({ prazo_contratual: dl({}) });
    const cell = screen.getByTestId("painel-prazo-cell");
    expect(cell).toHaveAttribute("data-health", "no_prazo");
    expect(cell).toHaveTextContent("No prazo");
    expect(cell).toHaveTextContent("30 du de folga · 27/11/26");
  });
  it("atrasada: mostra dias úteis de atraso", () => {
    renderCell({ prazo_contratual: dl({ business_days_remaining: -8, business_days_late: 8 }) });
    const cell = screen.getByTestId("painel-prazo-cell");
    expect(cell).toHaveAttribute("data-health", "atrasada");
    expect(cell).toHaveTextContent("8 du de atraso");
  });
  it("atenção com folga curta", () => {
    renderCell({ prazo_contratual: dl({ business_days_remaining: 3 }) });
    expect(screen.getByTestId("painel-prazo-cell")).toHaveAttribute("data-health", "atencao");
  });
  it("marca com * quando o prazo ainda não foi conferido", () => {
    renderCell({ prazo_contratual: dl({ contract_terms_confirmed: false }) });
    expect(screen.getByTestId("painel-prazo-cell")).toHaveTextContent("*");
  });
  it("sem prazo contratual", () => {
    renderCell({ prazo_contratual: null });
    expect(screen.getByTestId("painel-prazo-cell")).toHaveTextContent("Sem prazo");
  });
  it("entregue: não mostra como atrasada", () => {
    renderCell({ entrega_real: "2026-12-02", prazo_contratual: dl({ business_days_remaining: -3, business_days_late: 3 }) });
    const cell = screen.getByTestId("painel-prazo-cell");
    expect(cell).toHaveAttribute("data-health", "entregue");
    expect(cell).toHaveTextContent("Entregue com 3 du de atraso");
  });
});

describe("prazoResumo", () => {
  it("vence hoje", () => {
    expect(prazoResumo(dl({ business_days_remaining: 0 }), false)).toBe("Vence hoje");
  });
});
