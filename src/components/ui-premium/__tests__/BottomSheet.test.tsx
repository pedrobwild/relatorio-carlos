import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomSheet, type BottomSheetActionItem } from "../BottomSheet";

describe("BottomSheet", () => {
  it("renders the title and actions when open", () => {
    const onSelect = vi.fn();
    const actions: BottomSheetActionItem[] = [
      { label: "Editar", onSelect },
      { label: "Excluir", onSelect: vi.fn(), tone: "destructive" },
    ];

    render(
      <BottomSheet
        open
        onOpenChange={vi.fn()}
        title="Acoes"
        actions={actions}
      />,
    );

    expect(screen.getByRole("heading", { name: /acoes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /excluir/i }),
    ).toBeInTheDocument();
  });

  it("calls onSelect and closes the sheet when an action is picked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const actions: BottomSheetActionItem[] = [{ label: "Confirmar", onSelect }];

    render(
      <BottomSheet
        open
        onOpenChange={onOpenChange}
        title="Confirmacao"
        actions={actions}
      />,
    );

    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables actions when disabled is set", () => {
    const onSelect = vi.fn();
    const actions: BottomSheetActionItem[] = [
      { label: "Bloqueado", onSelect, disabled: true },
    ];

    render(
      <BottomSheet
        open
        onOpenChange={vi.fn()}
        title="Acoes"
        actions={actions}
      />,
    );

    const button = screen.getByRole("button", { name: /bloqueado/i });
    expect(button).toBeDisabled();
  });
});
