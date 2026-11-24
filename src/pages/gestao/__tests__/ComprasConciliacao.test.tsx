import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComprasObraVinculo } from "@/infra/repositories/comprasSync.repository";

const decidir = vi.fn();
const atualizar = vi.fn();
let pode = true;
let vinculos: ComprasObraVinculo[] = [];

vi.mock("@/hooks/useCan", () => ({
  useCanFeature: (f: string) => (f === "compras:conciliar" ? pode : true),
}));
vi.mock("@/hooks/useComprasSync", () => ({
  useComprasVinculos: () => ({ data: vinculos, isLoading: false }),
  useComprasUltimaExecucao: () => ({
    data: { id: "e", origem: "agendado", iniciado_em: new Date().toISOString(), terminado_em: new Date().toISOString(), ok: true, solicitacoes: 3, obras_novas: 0, erro: null },
  }),
  useObrasWorkflowParaVinculo: () => ({
    data: [
      { id: "p1", name: "Itaim 112", unit_name: "112", customer_name: "Maria Silva" },
      { id: "p2", name: "Pinheiros 45", unit_name: null, customer_name: "João Araújo" },
    ],
    isLoading: false,
  }),
  useDecidirVinculo: () => ({ mutate: decidir, isPending: false }),
  useAtualizarCompras: () => ({ mutate: atualizar, isPending: false }),
}));

import ComprasConciliacao from "../ComprasConciliacao";

const v = (over: Partial<ComprasObraVinculo>): ComprasObraVinculo => ({
  id: "v1", chave: "k", cliente: "Maria Silva", empreendimento: "Itaim", unidade: "112",
  project_id: null, status: "pendente", decidido_por_nome: null, decidido_em: null,
  ultima_vez_em: "2026-11-24T12:00:00Z", solicitacoes: 2, project: null, ...over,
});

const abrir = () => render(<MemoryRouter><ComprasConciliacao /></MemoryRouter>);

describe("ComprasConciliacao", () => {
  beforeEach(() => {
    decidir.mockClear();
    atualizar.mockClear();
    pode = true;
    vinculos = [
      v({}),
      v({ id: "v2", cliente: "João", empreendimento: null, unidade: null, status: "confirmado", project_id: "p2", project: { id: "p2", name: "Pinheiros 45" }, decidido_por_nome: "Ana" }),
    ];
  });

  it("mostra as pendentes primeiro, com a contagem por situação", () => {
    abrir();
    expect(screen.getByRole("tab", { name: /A vincular \(1\)/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Vinculadas \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText(/2 solicitações/)).toBeInTheDocument();
  });

  it("não vincula nada sozinho: só confirma depois de a pessoa escolher a obra", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Vincular obra/ }));
    const confirmar = screen.getByRole("button", { name: "Confirmar vínculo" });
    expect(confirmar).toBeDisabled();
    expect(decidir).not.toHaveBeenCalled();

    const lista = screen.getByRole("list", { name: "Obras do Workflow" });
    expect(within(lista).getByText(/Já vinculada a: João/)).toBeInTheDocument();
    fireEvent.click(within(lista).getByText("Itaim 112"));
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    expect(decidir).toHaveBeenCalledWith(
      { vinculoId: "v1", acao: "confirmar", projectId: "p1" },
      expect.anything(),
    );
  });

  it("filtra a lista pela busca", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Vincular obra/ }));
    fireEvent.change(screen.getByLabelText("Buscar obra do Workflow"), { target: { value: "araujo" } });
    const lista = screen.getByRole("list", { name: "Obras do Workflow" });
    expect(within(lista).queryByText("Itaim 112")).not.toBeInTheDocument();
    expect(within(lista).getByText("Pinheiros 45")).toBeInTheDocument();
  });

  it("desfaz um vínculo e ignora o que não é obra", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Não é obra" }));
    expect(decidir).toHaveBeenCalledWith({ vinculoId: "v1", acao: "ignorar" });
    fireEvent.click(screen.getByRole("tab", { name: /Vinculadas/ }));
    expect(screen.getByText("Pinheiros 45")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Desfazer vínculo/ }));
    expect(decidir).toHaveBeenCalledWith({ vinculoId: "v2", acao: "desfazer" });
  });

  it("quem não pode conciliar só consulta", () => {
    pode = false;
    abrir();
    expect(screen.queryByRole("button", { name: /Vincular obra/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Você pode consultar/)).toBeInTheDocument();
  });

  it("atualiza na hora pelo botão", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Atualizar agora/ }));
    expect(atualizar).toHaveBeenCalled();
  });
});
