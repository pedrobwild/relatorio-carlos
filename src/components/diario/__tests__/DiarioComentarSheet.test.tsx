import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const criar = vi.fn();
const marcar = vi.fn();

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
vi.mock("@/hooks/useProjectInternalNotes", () => ({
  useCreateInternalNote: () => ({ mutate: criar, isPending: false }),
}));
vi.mock("@/hooks/useInternalNoteMentions", () => ({
  useSetNoteMentions: () => ({ mutate: marcar, isPending: false }),
}));
vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({
    data: [
      { id: "eu", nome: "Eu Mesma", email: "eu@b", perfil: "admin" },
      { id: "mari", nome: "Mariana", email: "m@b", perfil: "admin" },
      { id: "thi", nome: "Thiago Dantas", email: "t@b", perfil: "admin" },
    ],
    isLoading: false,
    isError: false,
  }),
}));

import { DiarioComentarSheet } from "../DiarioComentarSheet";

const abrir = (onClose = vi.fn()) =>
  render(
    <DiarioComentarSheet projectId="p1" contexto={{ dia: "2026-11-24", etapa: "Pintura" }} onClose={onClose} />,
  );

describe("DiarioComentarSheet", () => {
  beforeEach(() => {
    criar.mockReset();
    marcar.mockReset();
  });

  it("mostra de qual relato é e avisa que o cliente não vê", () => {
    abrir();
    expect(screen.getByText(/Diário de 24\/11 · Pintura/)).toBeInTheDocument();
    expect(screen.getByText(/O cliente não/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  });

  it("registra como observação interna da obra e marca quem foi escolhido", () => {
    criar.mockImplementation((_input, opts) => opts.onSuccess({ id: "nota1" }));
    const onClose = vi.fn();
    abrir(onClose);
    fireEvent.change(screen.getByLabelText("Comentário"), { target: { value: "Falta comprar tinta." } });
    fireEvent.click(screen.getByRole("button", { name: /Marcar alguém/ }));
    expect(screen.queryByText("Eu Mesma")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Mariana"));
    expect(screen.getByRole("button", { name: "Tirar Mariana" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(criar).toHaveBeenCalledWith(
      { projectId: "p1", body: "Diário de 24/11 · Pintura\nFalta comprar tinta.", category: "outro" },
      expect.anything(),
    );
    expect(marcar).toHaveBeenCalledWith({ noteId: "nota1", userIds: ["mari"] });
    expect(onClose).toHaveBeenCalled();
  });

  it("sem ninguém marcado, só registra o comentário", () => {
    criar.mockImplementation((_input, opts) => opts.onSuccess({ id: "nota2" }));
    abrir();
    fireEvent.change(screen.getByLabelText("Comentário"), { target: { value: "Ok." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(criar).toHaveBeenCalled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("fechado sem relato", () => {
    render(<DiarioComentarSheet projectId={null} contexto={null} onClose={vi.fn()} />);
    expect(screen.queryByText("Comentar e marcar")).not.toBeInTheDocument();
  });
});
