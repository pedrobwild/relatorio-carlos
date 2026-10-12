/**
 * Kanban do Painel: colunas que recebem ou não cartões, cartões travados,
 * e o cartão de projeto (etiqueta da situação + prazo). O que soltar numa
 * coluna SIGNIFICA é decidido por quem usa (ver Obras.test.tsx).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { KanbanCardData } from "@/lib/painelNovo";
import { EtapaKanban, type KanbanColumn } from "../EtapaKanban";

const card = (p: Partial<KanbanCardData>): KanbanCardData => ({
  id: "x",
  name: "Obra",
  customer: null,
  responsible: null,
  etapa: null,
  risk: null,
  headline: "",
  headlineTone: "muted",
  alert: null,
  paused: false,
  relationship: null,
  ...p,
});

const colunas = (): KanbanColumn[] => [
  { key: "sem", label: "Sem etapa registrada", droppable: false, items: [card({ id: "novo", name: "Studio Pinheiros" })] },
  {
    key: "projeto_3d",
    label: "Projeto 3D",
    items: [
      card({
        id: "loft",
        name: "Loft Itaim",
        customer: "Bruno",
        responsible: "Bruna",
        fase: { verdict: "atrasada", text: "Atrasada há 4 dias" },
        headline: "Prazo 10/10/26",
      }),
    ],
  },
  { key: "medicao_fina", label: "Medição fina in loco", items: [] },
  {
    key: "pronta",
    label: "Pronta para iniciar",
    items: [card({ id: "casa", name: "Casa Perdizes", fase: { verdict: "pronta", text: "Pronta para iniciar" }, locked: true })],
  },
];

/** dataTransfer de mentira: o jsdom não tem. */
function transfer() {
  const store = new Map<string, string>();
  return {
    setData: (k: string, v: string) => store.set(k, v),
    getData: (k: string) => store.get(k) ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

const coluna = (nome: string) => screen.getByRole("region", { name: nome });
const cartao = (nome: RegExp) => screen.getByRole("button", { name: nome });

function arrastar(nome: RegExp, destino: string) {
  const dataTransfer = transfer();
  fireEvent.dragStart(cartao(nome), { dataTransfer });
  const aceita = !fireEvent.dragOver(coluna(destino), { dataTransfer });
  fireEvent.drop(coluna(destino), { dataTransfer });
  return aceita;
}

describe("EtapaKanban", () => {
  it("cartão de projeto: a situação vem em texto (etiqueta), com o prazo e o responsável", () => {
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} onMove={vi.fn()} label="Obras por etapa da fase de projeto" />);
    expect(screen.getByRole("group", { name: "Obras por etapa da fase de projeto" })).toBeInTheDocument();
    const c = within(coluna("Projeto 3D: 1")).getByRole("button", { name: /Loft Itaim/ });
    expect(within(c).getByText("Atrasada há 4 dias")).toHaveAttribute("data-verdict", "atrasada");
    expect(c).toHaveTextContent("Prazo 10/10/26");
    expect(c).toHaveTextContent("Bruna");
    // Sem linha de prazo, o cartão não deixa um espaço vazio no lugar.
    expect(within(cartao(/Studio Pinheiros/)).queryByText(/Prazo/)).toBeNull();
  });

  it("soltar numa coluna de etapa avisa quem usa, com a chave da coluna", () => {
    const onMove = vi.fn();
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} onMove={onMove} />);
    expect(arrastar(/Loft Itaim/, "Medição fina in loco: 0")).toBe(true);
    expect(onMove).toHaveBeenCalledWith("loft", "medicao_fina");
  });

  it("soltar na própria coluna não faz nada", () => {
    const onMove = vi.fn();
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} onMove={onMove} />);
    arrastar(/Loft Itaim/, "Projeto 3D: 1");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("coluna que não recebe cartões recusa o arrasto e não chama nada", () => {
    const onMove = vi.fn();
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} onMove={onMove} />);
    expect(arrastar(/Loft Itaim/, "Sem etapa registrada: 1")).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    // Mas o cartão que está nela pode sair.
    expect(cartao(/Studio Pinheiros/)).toHaveAttribute("draggable", "true");
    expect(arrastar(/Studio Pinheiros/, "Projeto 3D: 1")).toBe(true);
    expect(onMove).toHaveBeenCalledWith("novo", "projeto_3d");
  });

  it("cartão travado não arrasta (e, se for solto mesmo assim, nada acontece)", () => {
    const onMove = vi.fn();
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} onMove={onMove} />);
    expect(cartao(/Casa Perdizes/)).toHaveAttribute("draggable", "false");
    arrastar(/Casa Perdizes/, "Projeto 3D: 1");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("sem permissão (sem onMove): nenhum cartão arrasta e nenhuma coluna aceita", () => {
    render(<EtapaKanban groups={colunas()} onOpen={vi.fn()} />);
    for (const c of screen.getAllByRole("button")) expect(c).toHaveAttribute("draggable", "false");
    expect(arrastar(/Loft Itaim/, "Medição fina in loco: 0")).toBe(false);
    expect(within(coluna("Medição fina in loco: 0")).getByText("Nenhuma obra")).toBeInTheDocument();
  });

  it("coluna vazia convida a arrastar só quando recebe cartões", () => {
    const groups = [...colunas(), { key: "x", label: "Etapas não carregadas", droppable: false, items: [] }];
    render(<EtapaKanban groups={groups} onOpen={vi.fn()} onMove={vi.fn()} />);
    expect(within(coluna("Medição fina in loco: 0")).getByText("Arraste uma obra para cá")).toBeInTheDocument();
    expect(within(coluna("Etapas não carregadas: 0")).getByText("Nenhuma obra")).toBeInTheDocument();
  });

  it("teclado: Enter ou espaço no cartão abre a gaveta (o caminho para mudar a etapa sem arrastar)", () => {
    const onOpen = vi.fn();
    render(<EtapaKanban groups={colunas()} onOpen={onOpen} onMove={vi.fn()} />);
    const c = cartao(/Loft Itaim/);
    expect(c).toHaveAttribute("tabindex", "0");
    expect(c.tagName).toBe("DIV"); // o Firefox não arrasta <button>
    fireEvent.keyDown(c, { key: "Enter" });
    fireEvent.keyDown(c, { key: " " });
    fireEvent.click(cartao(/Casa Perdizes/));
    expect(onOpen.mock.calls).toEqual([["loft"], ["loft"], ["casa"]]);
  });
});
