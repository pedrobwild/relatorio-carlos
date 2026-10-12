/**
 * Lista de Projetos do Painel (tabela e cartões): etapa atual, situação do
 * prazo em texto, prazo e responsável da etapa; obra sem etapa registrada;
 * e o estado neutro quando as etapas não chegaram.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { buildProjetoRow, type ProjetoRow } from "@/lib/painelNovo";
import { PHASE_STEPS, type PhaseStepRow } from "@/lib/faseProjeto";
import type { PainelObra } from "@/hooks/usePainelObras";
import { ProjetosCards, ProjetosTable } from "../OutrasListas";

const TODAY = "2026-10-14";

const obra = (p: Partial<PainelObra>): PainelObra =>
  ({
    id: "p",
    nome: "Loft Itaim",
    customer_name: "Bruno Lima",
    engineer_name: null,
    etapa: null,
    inicio_etapa: null,
    status: null,
    relacionamento: null,
    responsavel_id: null,
    responsavel_nome: "Carla",
    // Meio-dia UTC: mesmo dia de calendário em São Paulo e em UTC.
    ultima_atualizacao: "2026-09-24T12:00:00Z",
    is_project_phase: true,
    ...p,
  }) as PainelObra;

/** As `n` primeiras etapas concluídas e a seguinte com o que for passado. */
function etapas(n: number, atual: Partial<PhaseStepRow> | null = null): PhaseStepRow[] {
  const base = { due_date: null, responsible_user_id: null, notes: null };
  const rows: PhaseStepRow[] = PHASE_STEPS.slice(0, n).map((s) => ({ ...base, step: s.key, done_at: "2026-10-01" }));
  if (atual && n < PHASE_STEPS.length) rows.push({ ...base, step: PHASE_STEPS[n].key, done_at: null, ...atual });
  return rows;
}

const equipe = new Map([["u1", "Bruna"]]);
const linhaDe = (p: Partial<PainelObra>, steps?: PhaseStepRow[]): ProjetoRow =>
  buildProjetoRow(obra(p), TODAY, steps ? { steps, staffNames: equipe } : undefined);

const atrasada = linhaDe({ id: "a", nome: "Loft Itaim" }, etapas(2, { due_date: "2026-10-10", responsible_user_id: "u1" }));
const pronta = linhaDe({ id: "b", nome: "Casa Perdizes", inicio_apos_aprovacao: "2026-10-21" }, etapas(6));
const semRegistroComAntiga = linhaDe({ id: "c", nome: "Studio Pinheiros", etapa: "Medição" }, []);
const semRegistro = linhaDe({ id: "d", nome: "Ap. Moema", ultima_atualizacao: "2026-10-13T12:00:00Z" }, []);
const desconhecida = linhaDe({ id: "e", nome: "Cobertura Jardins", etapa: "Projeto 3D" });
const desconhecidaSemAntiga = linhaDe({ id: "f", nome: "Flat Paulista" });
const venceLogo = linhaDe({ id: "g", nome: "Ap. Lapa", status: "Paralisada" }, etapas(0, { due_date: "2026-10-15" }));

const todas = [atrasada, venceLogo, semRegistroComAntiga, semRegistro, desconhecida, desconhecidaSemAntiga, pronta];
const celulas = (nome: RegExp) => within(screen.getByRole("row", { name: nome })).getAllByRole("cell");

describe("ProjetosTable", () => {
  it("colunas: projeto, etapa, situação, prazo e responsável", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Projeto",
      "Etapa",
      "Situação",
      "Prazo",
      "Responsável",
      "Abrir",
    ]);
  });

  it("etapa atual com o avanço, situação em texto, prazo e o responsável DA ETAPA", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    const linha = screen.getByRole("row", { name: /Loft Itaim/ });
    expect(within(linha).getByText("Bruno Lima")).toBeInTheDocument();
    const [etapa, situacao, prazo, responsavel] = celulas(/Loft Itaim/);
    expect(etapa).toHaveTextContent("Medição fina in loco");
    expect(etapa).toHaveTextContent("2 de 6 concluídas");
    expect(within(situacao).getByText("Atrasada há 4 dias")).toHaveAttribute("data-verdict", "atrasada");
    expect(prazo).toHaveTextContent("10/10/26");
    expect(responsavel).toHaveTextContent("Bruna"); // e não "Carla", a responsável pela obra
  });

  it("etapa sem responsável próprio mostra o da obra; marcações da obra continuam", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    const [etapa, situacao, prazo, responsavel] = celulas(/Ap\. Lapa/);
    expect(etapa).toHaveTextContent("Projeto 3D");
    expect(etapa).toHaveTextContent("0 de 6 concluídas");
    expect(within(situacao).getByText("Vence amanhã")).toHaveAttribute("data-verdict", "vence_logo");
    expect(prazo).toHaveTextContent("15/10/26");
    expect(responsavel).toHaveTextContent("Carla");
    expect(within(screen.getByRole("row", { name: /Ap\. Lapa/ })).getByText("Paralisada")).toBeInTheDocument();
  });

  it("as seis concluídas: 'Pronta para iniciar' com o início oficial", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    const [etapa, situacao, prazo] = celulas(/Casa Perdizes/);
    expect(within(situacao).getByText("Pronta para iniciar")).toHaveAttribute("data-verdict", "pronta");
    expect(etapa).toHaveTextContent("Todas as etapas concluídas");
    expect(etapa).toHaveTextContent("Início oficial: 21/10/2026 (5 dias úteis após a aprovação)");
    expect(prazo).toHaveTextContent("Todas as etapas concluídas"); // traço, com o motivo para leitor de tela
  });

  it("sem etapa registrada: a etapa antiga do Painel (ou o aviso) e há quanto tempo está parada", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    const [comAntiga, situacao, prazo] = celulas(/Studio Pinheiros/);
    expect(comAntiga).toHaveTextContent("Medição");
    expect(comAntiga).toHaveTextContent("Etapas não registradas · há 20 dias sem atualização");
    expect(comAntiga).not.toHaveTextContent(/de 6 concluídas/);
    expect(within(situacao).getByText("Sem prazo")).toHaveAttribute("data-verdict", "sem_prazo");
    expect(prazo).toHaveTextContent("Sem prazo");

    const [semAntiga] = celulas(/Ap\. Moema/);
    expect(semAntiga).toHaveTextContent("Etapas não registradas");
    expect(semAntiga).toHaveTextContent("Atualizada ontem");
    expect(semAntiga.textContent?.match(/Etapas não registradas/g)).toHaveLength(1);
  });

  it("etapas desconhecidas: linha neutra — nem 'Sem prazo' nem 'Etapas não registradas'", () => {
    render(<ProjetosTable rows={todas} onOpen={vi.fn()} />);
    for (const nome of [/Cobertura Jardins/, /Flat Paulista/]) {
      const linha = screen.getByRole("row", { name: nome });
      expect(linha).not.toHaveTextContent(/Sem prazo|Etapas não registradas|concluídas|Pronta/);
      expect(within(linha).queryByText(/./, { selector: "[data-verdict]" })).toBeNull();
      // O que vem do cadastro da obra continua: responsável e há quanto tempo está parada.
      expect(linha).toHaveTextContent("Carla");
      expect(linha).toHaveTextContent("Há 20 dias sem atualização");
    }
    expect(celulas(/Cobertura Jardins/)[0]).toHaveTextContent("Projeto 3D"); // etapa antiga, que é do cadastro
    expect(celulas(/Flat Paulista/)[0]).toHaveTextContent("Etapas não carregadas");
    expect(celulas(/Flat Paulista/)[1]).toHaveTextContent("Etapas não carregadas");
    expect(celulas(/Flat Paulista/)[2]).toHaveTextContent("Etapas não carregadas");
  });

  it("clicar na linha ou no nome abre a obra (uma vez só)", () => {
    const onOpen = vi.fn();
    render(<ProjetosTable rows={todas} onOpen={onOpen} />);
    fireEvent.click(within(screen.getByRole("row", { name: /Loft Itaim/ })).getByRole("button", { name: /Loft Itaim/ }));
    expect(onOpen.mock.calls).toEqual([["a"]]);
    fireEvent.click(celulas(/Casa Perdizes/)[2]);
    expect(onOpen).toHaveBeenLastCalledWith("b");
  });
});

describe("ProjetosCards (celular)", () => {
  const cartao = (nome: RegExp) => screen.getByRole("button", { name: nome });

  it("um cartão por obra, com etapa, situação em texto, prazo e responsável", () => {
    render(<ProjetosCards rows={todas} onOpen={vi.fn()} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(todas.length);
    const c = cartao(/Loft Itaim/);
    expect(c).toHaveTextContent("Bruno Lima");
    expect(c).toHaveTextContent("Medição fina in loco · 2 de 6 concluídas");
    expect(within(c).getByText("Atrasada há 4 dias")).toHaveAttribute("data-verdict", "atrasada");
    expect(c).toHaveTextContent("Prazo 10/10/26 · Bruna");
    expect(c.textContent?.match(/2 de 6 concluídas/g)).toHaveLength(1);
  });

  it("pronta, sem registro e desconhecida", () => {
    render(<ProjetosCards rows={todas} onOpen={vi.fn()} />);
    expect(cartao(/Casa Perdizes/)).toHaveTextContent("Início oficial: 21/10/2026 (5 dias úteis após a aprovação)");
    expect(within(cartao(/Casa Perdizes/)).getByText("Pronta para iniciar")).toBeInTheDocument();

    expect(cartao(/Studio Pinheiros/)).toHaveTextContent("Medição");
    expect(cartao(/Studio Pinheiros/)).toHaveTextContent("Etapas não registradas · há 20 dias sem atualização");
    expect(within(cartao(/Studio Pinheiros/)).getByText("Sem prazo")).toBeInTheDocument();

    const neutro = cartao(/Cobertura Jardins/);
    expect(neutro).not.toHaveTextContent(/Sem prazo|Etapas não registradas|concluídas/);
    expect(neutro).toHaveTextContent("Há 20 dias sem atualização");
    expect(neutro).toHaveTextContent("Carla");
  });

  it("tocar no cartão abre a obra", () => {
    const onOpen = vi.fn();
    render(<ProjetosCards rows={todas} onOpen={onOpen} />);
    fireEvent.click(cartao(/Ap\. Lapa/));
    expect(onOpen).toHaveBeenCalledWith("g");
  });
});
