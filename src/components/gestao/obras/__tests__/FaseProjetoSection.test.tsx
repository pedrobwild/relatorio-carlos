/**
 * Gaveta da obra — seção "Fase de projeto": as seis etapas em ordem, concluir
 * com data, reabrir, prazo e responsável gravados campo a campo, só leitura
 * sem permissão, o início oficial depois da aprovação do condomínio e os
 * cuidados durante a gravação (sem gravar duas vezes, sem desfazer o que foi
 * digitado, sem desmontar numa releitura).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { PhaseStepKey, PhaseStepRow } from "@/lib/faseProjeto";
import type { StaffUser } from "@/hooks/useStaffUsers";

const h = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  projectId: null as string | null,
  steps: {
    data: [] as unknown[] | undefined,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  save: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
vi.mock("@/hooks/useProjectPhase", () => ({
  useProjectPhaseSteps: (projectId: string) => {
    h.projectId = projectId;
    return h.steps;
  },
  useSaveProjectPhaseStep: () => ({ mutateAsync: h.save, isPending: false }),
}));
// Hoje fixo (quarta, 14/10/2026).
vi.mock("@/lib/hojeDia", async (orig) => ({
  ...(await orig<typeof import("@/lib/hojeDia")>()),
  todayISO: () => "2026-10-14",
}));

import { FaseProjetoSection, type FaseProjetoSectionProps } from "../FaseProjetoSection";

const etapa = (step: PhaseStepKey, p: Partial<PhaseStepRow> = {}): PhaseStepRow => ({
  step,
  done_at: null,
  due_date: null,
  responsible_user_id: null,
  notes: null,
  ...p,
});

const staff: StaffUser[] = [
  // Uma coordenadora de obra e duas pessoas que não são: todas podem responder por uma etapa.
  { id: "u1", nome: "Bruna Sampaio", email: "bruna.sampaio@bewild.com.br", perfil: "manager" },
  { id: "u2", nome: "Lucas Arquiteto", email: "lucas@bewild.com.br", perfil: "arquitetura" },
  { id: "u3", nome: "Paula CS", email: "paula@bewild.com.br", perfil: "cs" },
];

const props = (p: Partial<FaseProjetoSectionProps> = {}): FaseProjetoSectionProps => ({
  projectId: "p",
  staff,
  canEdit: true,
  officialStart: null,
  scheduleStart: null,
  ...p,
});

const tree = (p: Partial<FaseProjetoSectionProps> = {}) => (
  <MemoryRouter>
    <FaseProjetoSection {...props(p)} />
  </MemoryRouter>
);
const renderSection = (p: Partial<FaseProjetoSectionProps> = {}) => render(tree(p));

const grupo = (nome: string) => screen.getByRole("group", { name: nome });
const prazoDe = (nome: string) => within(grupo(nome)).getByLabelText("Prazo") as HTMLInputElement;

/** Promessa que o teste resolve quando quiser (gravação em andamento). */
function pendente<T = unknown>() {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  h.success.mockReset();
  h.error.mockReset();
  h.save.mockReset().mockResolvedValue({});
  h.projectId = null;
  h.steps = { data: [], isError: false, isLoading: false, isFetching: false, refetch: vi.fn() };
});

describe("Fase de projeto: a lista de etapas", () => {
  it("as seis etapas, na ordem, com a atual marcada e o resumo da obra", () => {
    h.steps.data = [
      etapa("projeto_3d", { done_at: "2026-10-01", responsible_user_id: "u2" }),
      etapa("projeto_executivo", { done_at: "2026-10-06" }),
      etapa("medicao_fina", { due_date: "2026-10-10", responsible_user_id: "u1" }),
    ];
    renderSection();
    const secao = screen.getByRole("region", { name: "Fase de projeto" });
    expect(h.projectId).toBe("p");
    expect(within(secao).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
      "Projeto 3D",
      "Projeto executivo",
      "Medição fina in loco",
      "Emissão da ART/RRT",
      "Pedido de aprovação ao condomínio",
      "Aprovação do condomínio recebida",
    ]);
    // Resumo: avanço e situação da etapa atual, em texto (não só cor).
    expect(within(secao).getByText("2 de 6 concluídas")).toBeInTheDocument();
    expect(within(secao).getAllByText("Atrasada há 4 dias")).toHaveLength(2);

    expect(within(grupo("Projeto 3D")).getByText("Concluída em 01/10/2026 · Lucas Arquiteto")).toBeInTheDocument();
    const atual = grupo("Medição fina in loco");
    expect(atual).toHaveAttribute("aria-current", "step");
    expect(within(atual).getByText("Etapa atual")).toBeInTheDocument();
    expect(grupo("Emissão da ART/RRT")).not.toHaveAttribute("aria-current");
    expect(within(grupo("Emissão da ART/RRT")).queryByText("Etapa atual")).toBeNull();
  });

  it("etapa em aberto mostra atraso ou prazo próximo, mesmo sem ser a atual", () => {
    h.steps.data = [
      etapa("projeto_3d", { due_date: "2026-12-01" }),
      etapa("emissao_art", { due_date: "2026-10-12" }),
      etapa("solicitacao_aprovacao", { due_date: "2026-10-15" }),
    ];
    renderSection();
    expect(within(grupo("Emissão da ART/RRT")).getByText("Atrasada há 2 dias")).toBeInTheDocument();
    expect(within(grupo("Pedido de aprovação ao condomínio")).getByText("Vence amanhã")).toBeInTheDocument();
    // Prazo longe ou sem prazo: sem etiqueta na etapa.
    expect(within(grupo("Projeto 3D")).queryByText(/No prazo|Sem prazo|Vence|Atrasada/)).toBeNull();
    expect(within(grupo("Projeto executivo")).queryByText(/No prazo|Sem prazo|Vence|Atrasada/)).toBeNull();
  });

  it("enquanto as etapas carregam não afirma nada; se falhar, oferece tentar de novo", () => {
    h.steps = { ...h.steps, data: undefined, isLoading: true };
    const { rerender } = renderSection();
    const secao = screen.getByRole("region", { name: "Fase de projeto" });
    expect(within(secao).getByLabelText("Carregando as etapas")).toBeInTheDocument();
    expect(within(secao).queryByRole("group")).toBeNull();
    expect(within(secao).queryByText(/Sem prazo|concluídas/)).toBeNull();

    h.steps = { ...h.steps, data: undefined, isLoading: false, isError: true };
    rerender(tree());
    expect(within(secao).getByText("Não deu para carregar as etapas desta obra.")).toBeInTheDocument();
    fireEvent.click(within(secao).getByRole("button", { name: "Tentar de novo" }));
    expect(h.steps.refetch).toHaveBeenCalled();
  });

  it("aviso no topo (ex.: veio do Kanban)", () => {
    renderSection({ notice: "Informe o dia em que a aprovação chegou." });
    expect(screen.getByRole("status")).toHaveTextContent("Informe o dia em que a aprovação chegou.");
  });
});

describe("Fase de projeto: concluir e reabrir", () => {
  it("concluir usa a data de hoje por padrão", async () => {
    renderSection();
    const g = grupo("Projeto 3D");
    fireEvent.click(within(g).getByRole("button", { name: "Concluir" }));
    const data = within(g).getByLabelText("Data de conclusão") as HTMLInputElement;
    expect(data.value).toBe("2026-10-14");
    expect(data).toHaveAttribute("max", "2026-10-14");
    expect(h.save).not.toHaveBeenCalled(); // abrir o formulário não grava

    fireEvent.click(within(g).getByRole("button", { name: "Confirmar conclusão" }));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", done_at: "2026-10-14" }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Etapa concluída"));
  });

  it("dá para escolher outra data; data futura é recusada sem gravar", async () => {
    renderSection();
    const g = grupo("Projeto executivo");
    fireEvent.click(within(g).getByRole("button", { name: "Concluir" }));
    const data = within(g).getByLabelText("Data de conclusão");

    fireEvent.change(data, { target: { value: "2026-10-20" } });
    fireEvent.click(within(g).getByRole("button", { name: "Confirmar conclusão" }));
    expect(h.error).toHaveBeenCalledWith("A data de conclusão não pode ser no futuro.");
    expect(h.save).not.toHaveBeenCalled();

    fireEvent.change(data, { target: { value: "" } });
    fireEvent.click(within(g).getByRole("button", { name: "Confirmar conclusão" }));
    expect(h.error).toHaveBeenLastCalledWith("Informe a data de conclusão.");
    expect(h.save).not.toHaveBeenCalled();

    fireEvent.change(data, { target: { value: "2026-10-09" } });
    fireEvent.click(within(g).getByRole("button", { name: "Confirmar conclusão" }));
    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_executivo", done_at: "2026-10-09" }),
    );
  });

  it("cancelar fecha o formulário sem gravar", () => {
    renderSection();
    const g = grupo("Projeto 3D");
    fireEvent.click(within(g).getByRole("button", { name: "Concluir" }));
    fireEvent.click(within(g).getByRole("button", { name: "Cancelar" }));
    expect(within(g).queryByLabelText("Data de conclusão")).toBeNull();
    expect(within(g).getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(h.save).not.toHaveBeenCalled();
  });

  it("aprovação do condomínio: a data é 'em que a aprovação chegou' e avisa o que ela define", async () => {
    renderSection();
    const g = grupo("Aprovação do condomínio recebida");
    fireEvent.click(within(g).getByRole("button", { name: "Concluir" }));
    expect(within(g).queryByLabelText("Data de conclusão")).toBeNull();
    const data = within(g).getByLabelText("Data em que a aprovação chegou");
    expect(within(g).getByText(/início oficial da obra conta 5 dias úteis a partir desta data/)).toBeInTheDocument();
    fireEvent.change(data, { target: { value: "2026-10-08" } });
    fireEvent.click(within(g).getByRole("button", { name: "Confirmar conclusão" }));
    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "aprovacao_condominio", done_at: "2026-10-08" }),
    );
  });

  it("um segundo toque em 'Confirmar' não grava de novo; o formulário fecha quando a etapa aparece concluída", async () => {
    const gravacao = pendente();
    h.save.mockReturnValue(gravacao.promise);
    const { rerender } = renderSection();
    const g = grupo("Projeto 3D");
    fireEvent.click(within(g).getByRole("button", { name: "Concluir" }));
    const confirmar = within(g).getByRole("button", { name: "Confirmar conclusão" });
    fireEvent.click(confirmar);
    await waitFor(() => expect(confirmar).toBeDisabled());
    fireEvent.click(confirmar);
    fireEvent.keyDown(within(g).getByLabelText("Data de conclusão"), { key: "Enter" });
    expect(h.save).toHaveBeenCalledTimes(1);

    // Gravou, mas a etapa ainda não chegou concluída: continua travado.
    gravacao.resolve({});
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Etapa concluída"));
    expect(confirmar).toBeDisabled();
    fireEvent.click(confirmar);
    expect(h.save).toHaveBeenCalledTimes(1);

    h.steps = { ...h.steps, data: [etapa("projeto_3d", { done_at: "2026-10-14" })] };
    rerender(tree());
    expect(within(g).queryByLabelText("Data de conclusão")).toBeNull();
    expect(within(g).getByText("Concluída em 14/10/2026")).toBeInTheDocument();
    expect(within(g).getByRole("button", { name: "Reabrir" })).toBeInTheDocument();
  });

  it("reabrir limpa a conclusão", async () => {
    h.steps.data = [etapa("projeto_3d", { done_at: "2026-10-01" })];
    renderSection();
    const g = grupo("Projeto 3D");
    expect(within(g).queryByRole("button", { name: "Concluir" })).toBeNull();
    fireEvent.click(within(g).getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", done_at: null }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Etapa reaberta"));
  });

  it("reabrir a aprovação do condomínio pede confirmação: apaga a data e o início oficial", async () => {
    h.steps.data = [etapa("aprovacao_condominio", { done_at: "2026-10-07" })];
    renderSection({ officialStart: "2026-10-15" });
    const g = grupo("Aprovação do condomínio recebida");
    fireEvent.click(within(g).getByRole("button", { name: "Reabrir" }));
    expect(h.save).not.toHaveBeenCalled();
    expect(within(g).getByText(/Reabrir apaga a data em que a aprovação chegou \(07\/10\/2026\) e o início\s+oficial/)).toBeInTheDocument();

    fireEvent.click(within(g).getByRole("button", { name: "Cancelar" }));
    expect(within(g).queryByText(/Reabrir apaga/)).toBeNull();
    expect(h.save).not.toHaveBeenCalled();

    fireEvent.click(within(g).getByRole("button", { name: "Reabrir" }));
    fireEvent.click(within(g).getByRole("button", { name: "Reabrir mesmo assim" }));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "aprovacao_condominio", done_at: null }));
  });

  it("etapa concluída não tem campos de prazo nem de responsável", () => {
    h.steps.data = [etapa("projeto_3d", { done_at: "2026-10-01", due_date: "2026-09-30" })];
    renderSection();
    const g = grupo("Projeto 3D");
    expect(within(g).queryByLabelText("Prazo")).toBeNull();
    expect(within(g).queryByRole("combobox")).toBeNull();
  });
});

describe("Fase de projeto: prazo e responsável", () => {
  it("prazo grava ao sair do campo; só o campo mudado é enviado", async () => {
    h.steps.data = [etapa("projeto_3d", { due_date: "2026-10-20", responsible_user_id: "u1" })];
    renderSection();
    expect(prazoDe("Projeto 3D").value).toBe("2026-10-20");
    fireEvent.change(prazoDe("Projeto 3D"), { target: { value: "2026-10-23" } });
    expect(h.save).not.toHaveBeenCalled();
    fireEvent.blur(prazoDe("Projeto 3D"));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", due_date: "2026-10-23" }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Prazo salvo"));
  });

  it("prazo em etapa ainda sem registro; apagar o prazo grava vazio; sair sem mudar não grava", async () => {
    h.steps.data = [etapa("projeto_3d", { due_date: "2026-10-20" })];
    renderSection();
    fireEvent.blur(prazoDe("Projeto 3D"));
    expect(h.save).not.toHaveBeenCalled();

    fireEvent.change(prazoDe("Emissão da ART/RRT"), { target: { value: "2026-11-05" } });
    fireEvent.blur(prazoDe("Emissão da ART/RRT"));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "emissao_art", due_date: "2026-11-05" }));

    fireEvent.change(prazoDe("Projeto 3D"), { target: { value: "" } });
    fireEvent.blur(prazoDe("Projeto 3D"));
    await waitFor(() => expect(h.save).toHaveBeenLastCalledWith({ project_id: "p", step: "projeto_3d", due_date: null }));
    await waitFor(() => expect(h.success).toHaveBeenLastCalledWith("Prazo removido"));
  });

  it("Enter e depois sair do campo grava uma vez só", async () => {
    const gravacao = pendente();
    h.save.mockReturnValue(gravacao.promise);
    renderSection();
    fireEvent.change(prazoDe("Projeto 3D"), { target: { value: "2026-10-23" } });
    fireEvent.keyDown(prazoDe("Projeto 3D"), { key: "Enter" });
    fireEvent.blur(prazoDe("Projeto 3D"));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    gravacao.resolve({});
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Prazo salvo"));
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("durante a gravação: o digitado não é desfeito por uma releitura, o campo não trava e a lista não desmonta", async () => {
    const gravacao = pendente();
    h.save.mockReturnValue(gravacao.promise);
    h.steps.data = [etapa("projeto_3d", { due_date: "2026-10-20" })];
    const { rerender } = renderSection();
    const campo = prazoDe("Projeto 3D");
    fireEvent.change(campo, { target: { value: "2026-10-23" } });
    fireEvent.blur(campo);
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));

    // Botões e seletores esperam; o campo de data não (quem tabula não perde o foco).
    expect(within(grupo("Projeto 3D")).getByRole("button", { name: "Concluir" })).toBeDisabled();
    expect(within(grupo("Projeto executivo")).getByRole("combobox")).toBeDisabled();
    expect(campo).not.toBeDisabled();
    expect(prazoDe("Projeto executivo")).not.toBeDisabled();

    // Releitura no meio do caminho, ainda com o prazo antigo.
    h.steps = { ...h.steps, isFetching: true, data: [etapa("projeto_3d", { due_date: "2026-10-20" })] };
    rerender(tree());
    expect(prazoDe("Projeto 3D")).toBe(campo); // o mesmo elemento: nada foi desmontado
    expect(campo.value).toBe("2026-10-23");

    // Gravou: o campo segue com o valor novo até o banco confirmar, sem piscar o antigo.
    gravacao.resolve({});
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Prazo salvo"));
    expect(campo.value).toBe("2026-10-23");
    await waitFor(() => expect(within(grupo("Projeto 3D")).getByRole("button", { name: "Concluir" })).not.toBeDisabled());

    h.steps = { ...h.steps, isFetching: false, data: [etapa("projeto_3d", { due_date: "2026-10-23" })] };
    rerender(tree());
    expect(campo.value).toBe("2026-10-23");
    // Depois de confirmado, o campo volta a seguir o banco (ex.: outra pessoa mudou).
    h.steps = { ...h.steps, data: [etapa("projeto_3d", { due_date: "2026-10-30" })] };
    rerender(tree());
    expect(campo.value).toBe("2026-10-30");
  });

  it("se a gravação falhar, o campo volta ao que está no banco e não há aviso de sucesso", async () => {
    h.save.mockRejectedValue(new Error("falhou"));
    h.steps.data = [etapa("projeto_3d", { due_date: "2026-10-20" })];
    renderSection();
    fireEvent.change(prazoDe("Projeto 3D"), { target: { value: "2026-10-23" } });
    fireEvent.blur(prazoDe("Projeto 3D"));
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    await waitFor(() => expect(prazoDe("Projeto 3D").value).toBe("2026-10-20"));
    expect(h.success).not.toHaveBeenCalled();
    await waitFor(() => expect(within(grupo("Projeto 3D")).getByRole("button", { name: "Concluir" })).not.toBeDisabled());
  });

  it("responsável: toda a equipe ativa (não só coordenadoras de obra)", async () => {
    h.steps.data = [etapa("projeto_3d", { responsible_user_id: "u1" })];
    renderSection();
    const seletor = within(grupo("Projeto 3D")).getByRole("combobox", { name: "Responsável" });
    expect(seletor).toHaveTextContent("Bruna Sampaio");
    await userEvent.click(seletor);
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "Sem responsável",
      "Bruna Sampaio",
      "Lucas Arquiteto",
      "Paula CS",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "Lucas Arquiteto" }));
    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", responsible_user_id: "u2" }),
    );
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Responsável salvo"));
  });

  it("tirar o responsável grava vazio; quem saiu da equipe continua visível na etapa", async () => {
    h.steps.data = [etapa("projeto_3d", { responsible_user_id: "u9" })];
    renderSection();
    const seletor = within(grupo("Projeto 3D")).getByRole("combobox", { name: "Responsável" });
    expect(seletor).toHaveTextContent("Fora da equipe ativa");
    await userEvent.click(seletor);
    await userEvent.click(await screen.findByRole("option", { name: "Sem responsável" }));
    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", responsible_user_id: null }),
    );
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Responsável removido"));
  });
});

describe("Fase de projeto: só leitura", () => {
  it("sem 'projectPhase:edit': nenhuma ação nem campo, só o que está registrado", () => {
    h.steps.data = [
      etapa("projeto_3d", { done_at: "2026-10-01" }),
      etapa("projeto_executivo", { due_date: "2026-10-20", responsible_user_id: "u2" }),
    ];
    renderSection({ canEdit: false });
    const secao = screen.getByRole("region", { name: "Fase de projeto" });
    expect(within(secao).queryByRole("button")).toBeNull();
    expect(within(secao).queryByRole("combobox")).toBeNull();
    expect(within(secao).queryByLabelText("Prazo")).toBeNull();

    expect(within(grupo("Projeto 3D")).getByText("Concluída em 01/10/2026")).toBeInTheDocument();
    const aberta = grupo("Projeto executivo");
    expect(within(aberta).getByText("Prazo").nextSibling).toHaveTextContent("20/10/2026");
    expect(within(aberta).getByText("Responsável").nextSibling).toHaveTextContent("Lucas Arquiteto");
    expect(within(grupo("Emissão da ART/RRT")).getByText("Prazo").nextSibling).toHaveTextContent("Sem prazo");
    expect(within(secao).getByText("Você não tem permissão para alterar a fase de projeto.")).toBeInTheDocument();
  });
});

describe("Fase de projeto: início oficial", () => {
  const aprovada = [etapa("aprovacao_condominio", { done_at: "2026-10-07" })];
  const TEXTO = "Início oficial: 15/10/2026 (5 dias úteis após a aprovação)";

  it("depois da aprovação registrada mostra o início oficial calculado pelo banco", () => {
    h.steps.data = aprovada;
    renderSection({ officialStart: "2026-10-15" });
    expect(within(grupo("Aprovação do condomínio recebida")).getByText(TEXTO)).toBeInTheDocument();
    expect(screen.queryByText(/O cronograma começa em/)).toBeNull();
  });

  it("cronograma começando em outro dia: avisa para ajustar, com o caminho", () => {
    h.steps.data = aprovada;
    renderSection({ officialStart: "2026-10-15", scheduleStart: "2026-11-02" });
    const g = grupo("Aprovação do condomínio recebida");
    expect(within(g).getByText(/O cronograma começa em 02\/11\/2026\./)).toBeInTheDocument();
    expect(within(g).getByRole("link", { name: "Ajuste o cronograma" })).toHaveAttribute("href", "/obra/p/cronograma");
  });

  it("cronograma já no início oficial: sem aviso", () => {
    h.steps.data = aprovada;
    renderSection({ officialStart: "2026-10-15", scheduleStart: "2026-10-15" });
    expect(screen.getByText(TEXTO)).toBeInTheDocument();
    expect(screen.queryByText(/O cronograma começa em/)).toBeNull();
  });

  it("sem a aprovação registrada não mostra início oficial, mesmo que a obra tenha a data", () => {
    h.steps.data = [etapa("solicitacao_aprovacao", { done_at: "2026-10-05" })];
    renderSection({ officialStart: "2026-10-15", scheduleStart: "2026-11-02" });
    expect(screen.queryByText(/Início oficial/)).toBeNull();
    expect(screen.queryByText(/O cronograma começa em/)).toBeNull();
  });

  it("aprovação registrada mas a data ainda não chegou do banco: não inventa", () => {
    h.steps.data = aprovada;
    renderSection({ officialStart: null });
    expect(screen.queryByText(/Início oficial/)).toBeNull();
  });
});
