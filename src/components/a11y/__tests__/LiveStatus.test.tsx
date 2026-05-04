import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveStatus, LiveAlert } from "../LiveStatus";

describe("LiveStatus", () => {
  it('expõe role="status" e aria-live="polite" por padrão', () => {
    render(<LiveStatus>Salvando relatório…</LiveStatus>);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveTextContent("Salvando relatório…");
  });

  it("é visualmente oculto por padrão (sr-only)", () => {
    render(<LiveStatus>Hidden</LiveStatus>);
    const region = screen.getByRole("status");
    expect(region.className).toContain("sr-only");
  });

  it("renderiza visível quando visuallyHidden=false", () => {
    render(<LiveStatus visuallyHidden={false}>Visible</LiveStatus>);
    const region = screen.getByRole("status");
    expect(region.className).not.toContain("sr-only");
  });

  it('aceita politeness="assertive"', () => {
    render(<LiveStatus politeness="assertive">Crítico</LiveStatus>);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it('LiveAlert usa role="alert" e aria-live="assertive"', () => {
    render(<LiveAlert>Erro!</LiveAlert>);
    const region = screen.getByRole("alert");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });
});
