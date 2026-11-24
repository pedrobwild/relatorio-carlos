import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useInternalNoteMentions", () => ({
  useMinhasMencoes: vi.fn(),
  useResolveMention: vi.fn(),
}));

import { MentionsInbox } from "@/components/gestao/minha-semana/MentionsInbox";
import { useMinhasMencoes, useResolveMention } from "@/hooks/useInternalNoteMentions";
import type { OpenInternalNoteMention } from "@/infra/repositories/internalNoteMentions.repository";

const resolveMutate = vi.fn();

const m = (over: Partial<OpenInternalNoteMention> = {}): OpenInternalNoteMention => ({
  id: "m1",
  note_id: "n1",
  project_id: "p1",
  mentioned_user_id: "eu",
  mentioned_name: "Sérgio Lima",
  requested_by: "u-carla",
  requested_by_name: "Carla Coordenadora",
  created_at: "2020-01-06T10:00:00Z",
  resolved_at: null,
  resolved_by: null,
  resolved_by_name: null,
  resolution_note: null,
  archived_at: null,
  project: { id: "p1", name: "Obra Alfa", painel_responsavel_id: null },
  note: { body: "Obra parada por falta de material.", category: "aguardando_material" },
  responsavel_obra_id: null,
  ...over,
});

const estado = (over: Partial<ReturnType<typeof useMinhasMencoes>> = {}) =>
  vi.mocked(useMinhasMencoes).mockReturnValue({
    comigo: [],
    pediEmAberto: [],
    atrasadasNasMinhasObras: [],
    enabled: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useMinhasMencoes>);

const renderInbox = () =>
  render(
    <MemoryRouter>
      <MentionsInbox />
    </MemoryRouter>,
  );

describe("MentionsInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useResolveMention).mockReturnValue({ mutate: resolveMutate, isPending: false } as never);
  });

  it("não aparece para quem não é da equipe", () => {
    estado({ enabled: false, comigo: [m()] });
    const { container } = renderInbox();
    expect(container).toBeEmptyDOMElement();
  });

  it("some quando não há pendência", () => {
    estado();
    const { container } = renderInbox();
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra obra, quem pediu, texto e tempo, e resolve daqui mesmo", async () => {
    const user = userEvent.setup();
    estado({ comigo: [m()] });
    renderInbox();

    expect(screen.getByRole("heading", { name: "Pendências comigo" })).toBeInTheDocument();
    const card = screen.getByRole("listitem");
    expect(within(card).getByRole("link", { name: "Obra Alfa" })).toHaveAttribute("href", "/obra/p1");
    expect(within(card).getByText(/Carla Coordenadora pediu/)).toBeInTheDocument();
    expect(within(card).getByText("Obra parada por falta de material.")).toBeInTheDocument();
    expect(within(card).getByText(/Atrasada · há \d+ dias/)).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Resolver" }));
    const gaveta = await screen.findByRole("dialog");
    await user.click(within(gaveta).getByRole("button", { name: "Marcar como resolvida" }));
    expect(resolveMutate).toHaveBeenCalledWith({ mentionId: "m1", resposta: null }, expect.anything());
  });

  it("o que pedi e o atrasado nas minhas obras aparecem sem botão de resolver", () => {
    estado({
      pediEmAberto: [m({ id: "m2", requested_by: "eu", mentioned_user_id: "u-sergio" })],
      atrasadasNasMinhasObras: [m({ id: "m3", mentioned_user_id: "u-bia", mentioned_name: "Bia Souza" })],
    });
    renderInbox();
    expect(screen.getByRole("heading", { name: "Pedi e ainda está aberto" })).toBeInTheDocument();
    expect(screen.getByText(/Com Sérgio Lima/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atrasadas nas minhas obras" })).toBeInTheDocument();
    expect(screen.getByText(/Carla Coordenadora pediu · com Bia Souza/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
  });
});
