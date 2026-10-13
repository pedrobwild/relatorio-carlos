/**
 * Gaveta da obra: o que o escritório registra (responsável, etapa,
 * relacionamento, paralisada, datas) e o que é só leitura (situação).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PainelObra } from "@/hooks/usePainelObras";
import type { ObraRow } from "@/lib/obrasPainel";

const h = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  studioProjectId: null as string | null,
  phaseProjectId: null as string | null,
  phaseSteps: [] as unknown[],
  savePhase: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
vi.mock("@/hooks/useStudioInfo", () => ({
  useStudioInfo: (projectId: string) => {
    h.studioProjectId = projectId;
    return {
      data: { project_id: projectId, key_location: "Com o zelador" },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
  useUpdateStudioInfo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => true }) }));
// Cronograma interno: "editado pela equipe" com 2 itens de datas diferentes do cliente.
const internal = vi.hoisted(() => ({ customizedAt: "2026-10-10T15:00:00Z" as string | null }));
vi.mock("@/hooks/useInternalSchedule", () => ({
  useInternalScheduleState: () => ({ data: { customized_at: internal.customizedAt }, isSuccess: true }),
  useInternalSchedule: (_id: string, opts: { enabled?: boolean } = {}) =>
    opts.enabled === false
      ? { items: [], clientActivities: [], clientLoaded: false }
      : {
          clientLoaded: true,
          clientActivities: [
            { id: "c1", planned_start: "2026-11-02", planned_end: "2026-11-06" },
            { id: "c2", planned_start: "2026-11-09", planned_end: "2026-11-13" },
          ],
          items: [
            { client_activity_id: "c1", planned_start: "2026-11-02", planned_end: "2026-11-10" },
            { client_activity_id: "c2", planned_start: "2026-11-10", planned_end: "2026-11-13" },
            { client_activity_id: null, planned_start: "2026-11-02", planned_end: "2026-11-03" },
          ],
        },
}));
// Fase de projeto: as regras da seção estão em FaseProjetoSection.test.tsx.
vi.mock("@/hooks/useProjectPhase", () => ({
  useProjectPhaseSteps: (projectId: string) => {
    h.phaseProjectId = projectId;
    return { data: h.phaseSteps, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() };
  },
  useSaveProjectPhaseStep: () => ({ mutateAsync: h.savePhase, isPending: false }),
}));
// Hoje fixo (quarta, 14/10/2026) para as regras de "data futura".
vi.mock("@/lib/hojeDia", async (orig) => ({
  ...(await orig<typeof import("@/lib/hojeDia")>()),
  todayISO: () => "2026-10-14",
}));

import { ObraDrawer, validateObraDate, type ObraDrawerProps } from "../ObraDrawer";
import { buildProjetoRow } from "@/lib/painelNovo";

const obra = (p: Partial<PainelObra> = {}): PainelObra =>
  ({
    id: "a",
    nome: "Ap. 1204 Vila Mariana",
    customer_name: "Mariana Costa",
    engineer_name: null,
    inicio_oficial: "2026-08-03",
    entrega_oficial: "2026-11-27",
    inicio_real: "2026-08-10",
    entrega_real: null,
    etapa: "Execução",
    status: null,
    relacionamento: null,
    responsavel_id: null,
    responsavel_nome: null,
    ultima_atualizacao: "2026-10-01T12:00:00Z",
    is_project_phase: false,
    ...p,
  }) as PainelObra;

const row: ObraRow = {
  id: "a",
  name: "Ap. 1204 Vila Mariana",
  customer: "Mariana Costa",
  responsibleId: null,
  responsible: null,
  deadline: "2026-11-27",
  projectedEnd: "2026-12-03",
  slack: -4,
  penalty: 3600,
  progress: 40,
  consumed: 60,
  week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: false },
  alerts: [
    { kind: "multa", tone: "destructive", text: "R$ 3.600 de multa se nada mudar" },
    { kind: "etapa_atrasada", tone: "warning", text: "Elétrica atrasada 2 dias" },
  ],
  risk: "vermelho",
};

const onPatch = vi.fn();

function renderDrawer(props: Partial<ObraDrawerProps> = {}) {
  return render(
    <MemoryRouter>
      <ObraDrawer
        open
        onOpenChange={vi.fn()}
        obra={obra()}
        row={row}
        staff={[]}
        canEdit
        onPatch={onPatch}
        weekHref="/gestao/semana?obra=a&semana=2026-10-12"
        {...props}
      />
    </MemoryRouter>,
  );
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement;
const digitar = (nome: string, valor: string) => {
  fireEvent.change(campo(nome), { target: { value: valor } });
  fireEvent.blur(campo(nome));
};

describe("validateObraDate", () => {
  const o = obra();
  const hoje = "2026-10-14";

  it("apagar a data é sempre permitido", () => {
    expect(validateObraDate("entrega_real", null, o, hoje)).toBeNull();
  });

  it("recusa data malformada ou de outro século", () => {
    expect(validateObraDate("inicio_real", "14/10/2026", o, hoje)).toBe("Data inválida.");
    expect(validateObraDate("inicio_real", "0026-10-14", o, hoje)).toBe("Data inválida.");
  });

  it("datas reais não podem ser futuras (hoje pode)", () => {
    expect(validateObraDate("entrega_real", "2026-10-15", o, hoje)).toBe("Entrega real não pode ser uma data futura.");
    expect(validateObraDate("inicio_real", "2026-10-15", o, hoje)).toBe("Início real não pode ser uma data futura.");
    expect(validateObraDate("entrega_real", "2026-10-14", o, hoje)).toBeNull();
  });

  it("entrega não pode ser antes do início (real e previsto)", () => {
    expect(validateObraDate("entrega_real", "2026-08-09", o, hoje)).toMatch(/antes do início real/);
    expect(validateObraDate("inicio_real", "2026-10-10", obra({ entrega_real: "2026-10-09" }), hoje)).toMatch(/depois da entrega real/);
    expect(validateObraDate("entrega_oficial", "2026-08-02", o, hoje)).toMatch(/antes do início previsto/);
    expect(validateObraDate("inicio_oficial", "2026-11-28", o, hoje)).toMatch(/depois da entrega prevista/);
  });

  it("datas previstas podem ser futuras", () => {
    expect(validateObraDate("entrega_oficial", "2027-01-15", o, hoje)).toBeNull();
  });
});

describe("ObraDrawer", () => {
  beforeEach(() => {
    onPatch.mockReset().mockResolvedValue(undefined);
    h.success.mockReset();
    h.error.mockReset();
    h.phaseProjectId = null;
    h.phaseSteps = [];
    h.savePhase.mockReset().mockResolvedValue({});
  });

  it("situação é só leitura: entrega, folga, término projetado, multa e os outros avisos", () => {
    renderDrawer();
    const situacao = screen.getByRole("region", { name: "Situação da obra" });
    expect(within(situacao).getByText("Entrega do contrato").nextSibling).toHaveTextContent("27/11/26");
    expect(within(situacao).getByText("Folga").nextSibling).toHaveTextContent("−4 dias úteis");
    expect(within(situacao).getByText("Término projetado").nextSibling).toHaveTextContent("03/12/26");
    expect(within(situacao).getByText("Multa se nada mudar").nextSibling?.textContent?.replace(/\s/g, " ")).toMatch(/R\$\s?3\.600/);
    // A multa já está no quadro; a lista de avisos não repete.
    expect(within(situacao).getByText("Elétrica atrasada 2 dias")).toBeInTheDocument();
    expect(within(situacao).queryByText("R$ 3.600 de multa se nada mudar")).toBeNull();
    expect(within(situacao).queryByRole("textbox")).toBeNull();
    expect(screen.getByText("No vermelho")).toBeInTheDocument();
  });

  it("atalhos: semana, obra, cronograma e cadastro do contrato", () => {
    renderDrawer();
    const atalhos = screen.getByRole("navigation", { name: "Atalhos da obra" });
    const href = (nome: RegExp) => within(atalhos).getByRole("link", { name: nome }).getAttribute("href");
    expect(href(/Planejar a semana/)).toBe("/gestao/semana?obra=a&semana=2026-10-12");
    expect(href(/Abrir obra/)).toBe("/obra/a");
    expect(href(/Cronograma do cliente/)).toBe("/obra/a/cronograma");
    expect(href(/Cronograma interno/)).toBe("/obra/a/cronograma-interno");
    expect(href(/Cadastro e prazo do contrato/)).toBe("/gestao/obra/a");
  });

  it("mostra o fim do cronograma interno ao lado do do cliente quando diferem", () => {
    renderDrawer({ row: { ...row, internalPlannedEnd: "2026-12-04" } });
    const aviso = screen.getByTestId("drawer-internal-vs-client");
    expect(aviso).toHaveTextContent("Fim no cronograma interno 04/12/26");
    expect(aviso).toHaveTextContent("Cronograma do cliente 27/11/26");
    // Editado pela equipe: quantos itens diferem do cliente.
    expect(within(aviso).getByTestId("drawer-internal-diffs")).toHaveTextContent("2 diferenças com o cliente");
  });

  it("acompanhando o cliente (não editado): sem contagem de diferenças", () => {
    internal.customizedAt = null;
    renderDrawer({ row: { ...row, internalPlannedEnd: "2026-12-04" } });
    expect(screen.getByTestId("drawer-internal-vs-client")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-internal-diffs")).toBeNull();
    internal.customizedAt = "2026-10-10T15:00:00Z";
  });

  it("não repete as datas quando interno e cliente terminam no mesmo dia (ou sem interno)", () => {
    renderDrawer({ row: { ...row, internalPlannedEnd: "2026-11-27" } });
    expect(screen.queryByTestId("drawer-internal-vs-client")).toBeNull();
    renderDrawer({ row: { ...row, internalPlannedEnd: null } });
    expect(screen.queryByTestId("drawer-internal-vs-client")).toBeNull();
  });

  it("'Ficha da obra' abre a ficha desta obra por cima da gaveta", () => {
    renderDrawer();
    const atalhos = screen.getByRole("navigation", { name: "Atalhos da obra" });
    expect(screen.queryByRole("dialog", { name: "Ficha da obra" })).toBeNull();
    fireEvent.click(within(atalhos).getByRole("button", { name: "Ficha da obra" }));
    const ficha = screen.getByRole("dialog", { name: "Ficha da obra" });
    expect(h.studioProjectId).toBe("a");
    expect(within(ficha).getByText("Ap. 1204 Vila Mariana")).toBeInTheDocument();
    expect(within(ficha).getByText("Com o zelador")).toBeInTheDocument();
  });

  it("obra fora da execução não oferece 'Planejar a semana'", () => {
    renderDrawer({
      row: null,
      projeto: buildProjetoRow(
        obra({ etapa: "Projeto 3D", ultima_atualizacao: "2026-09-24T12:00:00Z", inicio_etapa: "2026-10-11", is_project_phase: true }),
        "2026-10-14",
      ),
    });
    expect(screen.queryByRole("link", { name: /Planejar a semana/ })).toBeNull();
    expect(screen.getByText("Em fase de projeto")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Situação do projeto" })).getByText("Há 20 dias")).toBeInTheDocument();
  });

  it("'Obra paralisada' grava e desfaz", async () => {
    const { unmount } = renderDrawer();
    fireEvent.click(screen.getByRole("switch", { name: "Obra paralisada" }));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("a", { status: "Paralisada" }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Obra marcada como paralisada"));
    unmount();

    renderDrawer({ obra: obra({ status: "Paralisada" }) });
    expect(screen.getByRole("switch", { name: "Obra paralisada" })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Obra paralisada" }));
    await waitFor(() => expect(onPatch).toHaveBeenLastCalledWith("a", { status: null }));
  });

  it("entrega real: grava ao sair do campo", async () => {
    renderDrawer();
    digitar("Entrega real", "2026-10-13");
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("a", { entrega_real: "2026-10-13" }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Entrega real salva"));
  });

  it("entrega real futura é recusada e o campo volta", () => {
    renderDrawer();
    digitar("Entrega real", "2026-10-20");
    expect(onPatch).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith("Entrega real não pode ser uma data futura.");
    expect(campo("Entrega real").value).toBe("");
  });

  it("gravar uma data não desabilita os campos de data (quem tabula não perde o foco)", async () => {
    let liberar: () => void = () => undefined;
    onPatch.mockReturnValue(new Promise<void>((resolve) => (liberar = resolve)));
    renderDrawer();
    digitar("Entrega real", "2026-10-13");
    await waitFor(() => expect(onPatch).toHaveBeenCalled());
    expect(campo("Início real")).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Obra paralisada" })).toBeDisabled();
    liberar();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Obra paralisada" })).not.toBeDisabled());
  });

  it("obra pausada no cadastro: avisa onde retomar", () => {
    renderDrawer({ row: { ...row, cadastro: { etapa: "Execução", relationship: null, paused: true } } });
    expect(screen.getByText(/status "Pausada" no cadastro/)).toBeInTheDocument();
  });

  it("sair do campo sem mudar nada não grava", () => {
    renderDrawer();
    fireEvent.blur(campo("Início real"));
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("apagar o início real grava vazio", async () => {
    renderDrawer();
    digitar("Início real", "");
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("a", { inicio_real: null }));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Início real removido"));
  });

  it("data prevista (vem do cronograma) pede confirmação antes de gravar", async () => {
    renderDrawer();
    digitar("Entrega prevista", "2026-12-04");
    expect(onPatch).not.toHaveBeenCalled();
    const aviso = screen.getByRole("alertdialog");
    expect(within(aviso).getByText("Alterar entrega prevista?")).toBeInTheDocument();
    fireEvent.click(within(aviso).getByRole("button", { name: "Alterar a data" }));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("a", { entrega_oficial: "2026-12-04" }));
  });

  it("cancelar a confirmação não grava e devolve a data", async () => {
    renderDrawer();
    digitar("Entrega prevista", "2026-12-04");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onPatch).not.toHaveBeenCalled();
    expect(campo("Entrega prevista").value).toBe("2026-11-27");
  });

  it("data prevista ainda vazia grava direto, sem confirmação", async () => {
    renderDrawer({ obra: obra({ inicio_oficial: null, entrega_oficial: null }) });
    digitar("Início previsto", "2026-11-02");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith("a", { inicio_oficial: "2026-11-02" }));
  });

  it("erro ao gravar não solta promessa nem dá aviso de sucesso", async () => {
    onPatch.mockRejectedValue(new Error("falhou"));
    renderDrawer();
    fireEvent.click(screen.getByRole("switch", { name: "Obra paralisada" }));
    await waitFor(() => expect(onPatch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("switch", { name: "Obra paralisada" })).not.toBeDisabled());
    expect(h.success).not.toHaveBeenCalled();
  });

  it("sem permissão: tudo desabilitado, com o motivo", () => {
    renderDrawer({ canEdit: false });
    expect(screen.getByRole("switch", { name: "Obra paralisada" })).toBeDisabled();
    expect(campo("Entrega real")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Etapa" })).toBeDisabled();
    expect(screen.getByText("Você não tem permissão para alterar o cadastro desta obra.")).toBeInTheDocument();
  });

  it("etapa finalizada sem entrega real pede a data", () => {
    renderDrawer({ obra: obra({ etapa: "Finalizada" }) });
    expect(screen.getByText(/Etapa finalizada sem entrega real/)).toBeInTheDocument();
  });

  it("obra não encontrada", () => {
    renderDrawer({ obra: null, row: null });
    expect(screen.getByText("Obra não encontrada")).toBeInTheDocument();
  });

  describe("obra em fase de projeto", () => {
    const emProjeto = (p: Partial<PainelObra> = {}) =>
      obra({ id: "p", etapa: "Projeto 3D", is_project_phase: true, inicio_oficial: null, entrega_oficial: null, inicio_real: null, ...p });

    it("a seção 'Fase de projeto' entra no lugar do seletor livre de etapa; o resto do cadastro fica", () => {
      h.phaseSteps = [{ step: "projeto_3d", done_at: "2026-10-01", due_date: null, responsible_user_id: null, notes: null }];
      renderDrawer({ obra: emProjeto(), row: null, canEditPhase: true });
      const fase = screen.getByRole("region", { name: "Fase de projeto" });
      expect(h.phaseProjectId).toBe("p");
      expect(within(fase).getAllByRole("group")).toHaveLength(6);
      expect(within(fase).getByText("1 de 6 concluídas")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Etapa" })).toBeNull();
      // Relacionamento, paralisada, responsável, datas e a ficha continuam.
      const cadastro = screen.getByRole("region", { name: "Cadastro da obra" });
      expect(within(cadastro).getByRole("combobox", { name: "Responsável" })).toBeInTheDocument();
      expect(within(cadastro).getByRole("combobox", { name: "Relacionamento com o cliente" })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Obra paralisada" })).toBeInTheDocument();
      expect(campo("Entrega real")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ficha da obra" })).toBeInTheDocument();
    });

    it("obra de antes do fluxo por etapas, já em 'Condomínio': as etapas anteriores aparecem concluídas, sem 'Reabrir'", () => {
      h.phaseSteps = [];
      renderDrawer({ obra: emProjeto({ etapa: "Condomínio" }), row: null, canEditPhase: true });
      const fase = screen.getByRole("region", { name: "Fase de projeto" });
      expect(within(fase).getByText("4 de 6 concluídas")).toBeInTheDocument();
      const tresD = within(fase).getByRole("group", { name: "Projeto 3D" });
      expect(within(tresD).getByText("Concluída antes do registro por etapas")).toBeInTheDocument();
      expect(within(tresD).queryByRole("button", { name: "Reabrir" })).toBeNull();
      const pedido = within(fase).getByRole("group", { name: "Pedido de aprovação ao condomínio" });
      expect(within(pedido).getByText("Etapa atual")).toBeInTheDocument();
    });

    it("obra em execução não mostra a seção", () => {
      renderDrawer();
      expect(screen.queryByRole("region", { name: "Fase de projeto" })).toBeNull();
      expect(screen.getByRole("combobox", { name: "Etapa" })).toBeInTheDocument();
      expect(h.phaseProjectId).toBeNull();
    });

    it("concluir uma etapa grava em project_phase_steps, não no cadastro da obra", async () => {
      renderDrawer({ obra: emProjeto(), row: null, canEditPhase: true });
      const etapa = screen.getByRole("group", { name: "Projeto 3D" });
      fireEvent.click(within(etapa).getByRole("button", { name: "Concluir" }));
      fireEvent.click(within(etapa).getByRole("button", { name: "Confirmar conclusão" }));
      await waitFor(() => expect(h.savePhase).toHaveBeenCalledWith({ project_id: "p", step: "projeto_3d", done_at: "2026-10-14" }));
      expect(onPatch).not.toHaveBeenCalled();
    });

    it("sem 'projectPhase:edit' a seção é só leitura, mesmo podendo editar o cadastro", () => {
      renderDrawer({ obra: emProjeto(), row: null, canEdit: true, canEditPhase: false });
      const fase = screen.getByRole("region", { name: "Fase de projeto" });
      expect(within(fase).queryByRole("button")).toBeNull();
      expect(within(fase).getByText("Você não tem permissão para alterar a fase de projeto.")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Obra paralisada" })).not.toBeDisabled();
    });

    it("mostra o início oficial e o aviso que veio do Kanban", () => {
      h.phaseSteps = [{ step: "aprovacao_condominio", done_at: "2026-10-07", due_date: null, responsible_user_id: null, notes: null }];
      renderDrawer({
        obra: emProjeto({ inicio_apos_aprovacao: "2026-10-15", inicio_oficial: "2026-11-02" }),
        row: null,
        canEditPhase: true,
        phaseNotice: "Informe o dia em que a aprovação chegou.",
      });
      const fase = screen.getByRole("region", { name: "Fase de projeto" });
      expect(within(fase).getByText("Início oficial: 15/10/2026 (5 dias úteis após a aprovação)")).toBeInTheDocument();
      expect(within(fase).getByRole("status")).toHaveTextContent("Informe o dia em que a aprovação chegou.");
      expect(within(fase).getByRole("link", { name: "Ajuste o cronograma" })).toHaveAttribute("href", "/obra/p/cronograma");
    });
  });
});
