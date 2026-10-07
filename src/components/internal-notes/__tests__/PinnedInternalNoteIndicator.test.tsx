import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PinnedInternalNoteIndicator } from "@/components/internal-notes/PinnedInternalNoteIndicator";
import type { ProjectInternalNote } from "@/infra/repositories";

/**
 * O selo vive dentro de linhas e cards clicáveis (Painel de Obras, CS):
 * nem clique nem Enter/Espaço nele podem disparar a abertura da obra.
 */

const note: ProjectInternalNote = {
  id: "n1",
  project_id: "p1",
  author_id: "u1",
  author_name: "Ana Obras",
  body: "Aguardando o cliente voltar de viagem.",
  category: "aguardando_cliente",
  is_pinned: true,
  edited_at: null,
  deleted_at: null,
  created_at: "2026-10-07T10:00:00Z",
  updated_at: "2026-10-07T10:00:00Z",
};

const renderInCard = (n: ProjectInternalNote | null) => {
  const onOpen = vi.fn();
  render(
    <TooltipProvider>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen();
        }}
      >
        <PinnedInternalNoteIndicator note={n} />
      </div>
    </TooltipProvider>,
  );
  return onOpen;
};

describe("PinnedInternalNoteIndicator", () => {
  it("sem nota, não renderiza nada", () => {
    renderInCard(null);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("mostra a categoria", () => {
    renderInCard(note);
    expect(screen.getByRole("note")).toHaveTextContent("Aguardando cliente");
  });

  it("clique, Enter e Espaço no selo não abrem o card", () => {
    const onOpen = renderInCard(note);
    const badge = screen.getByRole("note");
    fireEvent.click(badge);
    fireEvent.keyDown(badge, { key: "Enter" });
    fireEvent.keyDown(badge, { key: " " });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
