import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
import { FileText, Plus } from "lucide-react";

describe("EmptyState", () => {
  it("renders title correctly", () => {
    const { getByText } = render(
      <EmptyState title="Nenhum documento encontrado" />,
    );

    expect(getByText("Nenhum documento encontrado")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    const { getByText } = render(
      <EmptyState
        title="Nenhum documento"
        description="Envie seu primeiro documento para começar"
      />,
    );

    expect(
      getByText("Envie seu primeiro documento para começar"),
    ).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <EmptyState
        title="Nenhum documento"
        action={{
          label: "Adicionar documento",
          onClick,
        }}
      />,
    );

    const button = getByRole("button", { name: /adicionar documento/i });
    expect(button).toBeInTheDocument();

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action when provided", () => {
    const secondaryClick = vi.fn();
    const { getByRole } = render(
      <EmptyState
        title="Nenhum documento"
        secondaryAction={{
          label: "Saiba mais",
          onClick: secondaryClick,
        }}
      />,
    );

    const button = getByRole("button", { name: /saiba mais/i });
    expect(button).toBeInTheDocument();

    button.click();
    expect(secondaryClick).toHaveBeenCalledTimes(1);
  });

  it("renders custom icon when provided", () => {
    render(<EmptyState title="Nenhum arquivo" icon={FileText} />);

    // Icon should be rendered (testing by aria-hidden attribute)
    const icon = document.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it("renders action with icon", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <EmptyState
        title="Nenhum item"
        action={{
          label: "Adicionar",
          onClick,
          icon: Plus,
        }}
      />,
    );

    expect(getByRole("button", { name: /adicionar/i })).toBeInTheDocument();
  });

  it("applies compact styling when compact prop is true", () => {
    const { container } = render(<EmptyState title="Compacto" compact />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("py-8");
  });

  it("applies custom className", () => {
    const { container } = render(
      <EmptyState title="Custom" className="custom-class" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("has correct accessibility attributes", () => {
    const { getByRole } = render(<EmptyState title="Estado vazio" />);

    const status = getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Estado vazio");
  });

  it("renders children when provided", () => {
    const { getByTestId } = render(
      <EmptyState title="Com children">
        <div data-testid="custom-content">Conteúdo personalizado</div>
      </EmptyState>,
    );

    expect(getByTestId("custom-content")).toBeInTheDocument();
  });

  describe("variants", () => {
    const variants = [
      "documents",
      "formalizations",
      "schedule",
      "purchases",
      "payments",
      "generic",
    ] as const;

    variants.forEach((variant) => {
      it(`renders ${variant} variant without errors`, () => {
        const { getByText } = render(
          <EmptyState title={`${variant} empty state`} variant={variant} />,
        );
        expect(getByText(`${variant} empty state`)).toBeInTheDocument();
      });
    });
  });
});
