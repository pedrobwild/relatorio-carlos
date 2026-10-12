/**
 * Gaveta da obra: o que o escritório registra (responsável, etapa,
 * relacionamento, paralisada, datas) e o que é só leitura (situação).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PainelObra } from "@/hooks/usePainelObras";
import type { ObraRow } from "@/lib/obrasPainel";

const h = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), studioProjectId: null as string | null }));
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
// Hoje fixo (quarta, 14/10/2026) para as regras de "data futura".
vi.mock("@/lib/hojeDia", async (orig) => ({
  ...(await orig<typeof import("@/lib/hojeDia")>()),
  todayISO: () => "2026-10-14",
}));

import { ObraDrawer, validateObraDate, type ObraDrawerProps } from "../ObraDrawer";

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
    expect(href(/Cronograma/)).toBe("/obra/a/cronograma");
    expect(href(/Cadastro e prazo do contrato/)).toBe("/gestao/obra/a");
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
    renderDrawer({ row: null, projeto: { id: "a", name: "x", customer: null, responsibleId: null, responsible: null, etapa: "Projeto 3D", staleDays: 20, daysInEtapa: 3, relationship: null, paused: false } });
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
});
