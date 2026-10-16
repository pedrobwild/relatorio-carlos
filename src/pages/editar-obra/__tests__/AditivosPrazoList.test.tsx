import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  amendments: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useContractDeadline", () => ({
  useContractAmendments: () => ({ data: h.amendments, isLoading: false, isError: false }),
  useUpdateAmendmentStatus: () => ({ mutate: h.update, isPending: false }),
  useDeleteAmendmentDraft: () => ({ mutate: h.remove, isPending: false }),
}));
vi.mock("@/hooks/useOps", () => ({
  useOpsPhotoUrls: (paths: string[]) => ({
    data: paths.map((p) => ({ path: p, url: `https://x/${p}` })),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));

import { AditivosPrazoList } from "../AditivosPrazoList";

const row = (over: Record<string, unknown>) => ({
  id: "x1",
  project_id: "p1",
  reason: "condominio",
  business_days_added: 2,
  description: "Semana de 05/10 a 09/10: 2 dias sem execução (05/10, 06/10) em Passar conduíte — Condomínio.",
  event_date: "2026-10-05",
  evidence_urls: ["p1/d1/a.jpg"],
  status: "rascunho",
  ...over,
});

describe("AditivosPrazoList", () => {
  beforeEach(() => {
    h.update.mockReset();
    h.remove.mockReset();
    h.amendments = [];
  });

  it("sem aditivos explica onde o gestor registra", () => {
    render(<AditivosPrazoList projectId="p1" canEdit />);
    expect(screen.getByText(/O gestor registra no fechamento da semana/)).toBeInTheDocument();
  });

  it("rascunho: mostra motivo, dias, descrição e fotos; envia ao cliente", () => {
    h.amendments = [row({})];
    render(<AditivosPrazoList projectId="p1" canEdit />);
    expect(screen.getByText("Condomínio · +2 dias úteis")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("05/10/2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver 1 foto" }));
    expect(screen.getByRole("img", { name: "Evidência 1" })).toHaveAttribute("src", "https://x/p1/d1/a.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Marcar como enviado ao cliente" }));
    expect(h.update).toHaveBeenCalledWith({ id: "x1", status: "enviado" }, expect.anything());
  });

  it("aceitar pede confirmação (mexe no prazo e o cliente passa a ver)", () => {
    h.amendments = [row({ status: "enviado" })];
    render(<AditivosPrazoList projectId="p1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Cliente aceitou" }));
    expect(h.update).not.toHaveBeenCalled();
    expect(screen.getByText(/Os dias passam a contar no prazo e o cliente vê o aditivo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(h.update).toHaveBeenCalledWith({ id: "x1", status: "aceito" }, expect.anything());
  });

  it("contestado pode ser enviado de novo; aceito não tem ações", () => {
    h.amendments = [row({ id: "c", status: "contestado" }), row({ id: "a", status: "aceito", evidence_urls: [] })];
    render(<AditivosPrazoList projectId="p1" canEdit />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("button", { name: "Enviar de novo" })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("apagar só o rascunho, com confirmação", () => {
    h.amendments = [row({})];
    render(<AditivosPrazoList projectId="p1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar rascunho" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(h.remove).toHaveBeenCalledWith("x1", expect.anything());
  });

  it("sem permissão de editar: só leitura", () => {
    h.amendments = [row({})];
    render(<AditivosPrazoList projectId="p1" canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Marcar como enviado ao cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar rascunho" })).not.toBeInTheDocument();
  });
});
