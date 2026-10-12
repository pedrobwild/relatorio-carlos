/**
 * Ficha da obra (gaveta): leitura agrupada, senha escondida, aviso do que
 * falta, edição no lugar e estados de carregamento / erro.
 * Hooks de dados mockados: aqui testamos a tela, não o banco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import type { StudioInfo } from "@/infra/repositories/studioInfo.repository";

const h = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
  canEdit: true,
  success: vi.fn(),
  error: vi.fn(),
  usedProjectId: null as string | null,
}));

vi.mock("@/hooks/useStudioInfo", () => ({
  useStudioInfo: (projectId: string) => {
    h.usedProjectId = projectId;
    return { isLoading: false, isError: false, isFetching: false, refetch: h.refetch, ...h.query };
  },
  useUpdateStudioInfo: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: (f: string) => f === "ficha:edit" && h.canEdit }) }));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));

import { FichaObraSheet } from "../FichaObraSheet";

const ficha = (over: Partial<StudioInfo> = {}): StudioInfo =>
  ({
    project_id: "p1",
    nome_do_empreendimento: "Edifício Aurora",
    endereco_completo: "Rua Augusta, 1200",
    complemento: "Apto 142",
    bairro: "Consolação",
    cidade: "São Paulo",
    cep: "01304-001",
    tamanho_imovel_m2: 31,
    tipo_de_locacao: "Studio",
    data_recebimento_chaves: "2026-08-03",
    keys_received_by: "Thiago",
    key_location: "Na portaria, envelope da Bwild",
    electronic_lock_password: "4321#",
    allowed_work_days: ["mon", "tue", "wed", "thu", "fri"],
    allowed_work_start_time: "09:00",
    allowed_work_end_time: "17:00",
    access_release_process: "Enviar nome e RG para a administradora.\nAntecedência: 2 dias úteis.",
    provider_access_instructions: "<p>Identificar-se na portaria</p><ul><li>Elevador de serviço</li></ul>",
    syndic_name: "Dona Marta",
    syndic_phone: "(11) 99999-8888",
    syndic_email: "marta@aurora.com.br",
    building_manager_name: null,
    building_manager_phone: null,
    building_manager_email: null,
    concierge_name: "Portaria 24h",
    concierge_phone: "11 3333-4444",
    property_admin_name: "Lello",
    property_admin_phone: "0800 123 4567",
    property_admin_email: "atendimento@lello.com.br",
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    ...over,
  }) as StudioInfo;

const renderSheet = (props: Partial<React.ComponentProps<typeof FichaObraSheet>> = {}) =>
  render(<FichaObraSheet open onOpenChange={vi.fn()} projectId="p1" projectName="Apto 142 · Aurora" {...props} />);

describe("FichaObraSheet", () => {
  beforeEach(() => {
    h.query = { data: ficha() };
    h.refetch.mockReset();
    h.mutateAsync.mockReset();
    h.mutateAsync.mockResolvedValue(ficha());
    h.canEdit = true;
    h.success.mockReset();
    h.error.mockReset();
    h.usedProjectId = null;
  });

  it("mostra a ficha preenchida, agrupada", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog", { name: "Ficha da obra" });
    expect(within(dialog).getByText("Apto 142 · Aurora")).toBeInTheDocument();
    expect(h.usedProjectId).toBe("p1");

    for (const title of ["Endereço", "Chaves", "Fechadura eletrônica", "Condomínio", "Contatos"]) {
      expect(within(dialog).getByRole("heading", { name: title })).toBeInTheDocument();
    }

    // Endereço + mapa
    expect(within(dialog).getByText("Edifício Aurora")).toBeInTheDocument();
    expect(within(dialog).getByText("Rua Augusta, 1200 · Apto 142")).toBeInTheDocument();
    expect(within(dialog).getByText("Consolação · São Paulo")).toBeInTheDocument();
    const mapa = within(dialog).getByRole("link", { name: "Abrir no mapa" });
    expect(mapa).toHaveAttribute(
      "href",
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Rua Augusta, 1200, Consolação, São Paulo, 01304-001")}`,
    );

    // Chaves
    expect(within(dialog).getByText("Recebidas em 03/08/2026 por Thiago")).toBeInTheDocument();
    expect(within(dialog).getByText("Na portaria, envelope da Bwild")).toBeInTheDocument();

    // Condomínio
    expect(within(dialog).getByText("Seg a sex, 9h às 17h")).toBeInTheDocument();
    const liberacao = within(dialog).getByText(/Enviar nome e RG para a administradora/);
    expect(liberacao).toHaveTextContent("Antecedência: 2 dias úteis.");
    expect(liberacao).toHaveClass("whitespace-pre-line");
    expect(within(dialog).getByText("Identificar-se na portaria")).toBeInTheDocument();
    expect(within(dialog).getByText("Elevador de serviço").tagName).toBe("LI");

    // Ficha completa: sem aviso
    expect(within(dialog).queryByText(/nesta ficha/)).not.toBeInTheDocument();
  });

  it("contatos: telefone toca para ligar, WhatsApp e e-mail selecionável", () => {
    renderSheet();
    const sindico = screen.getByText("Síndico").closest("li") as HTMLElement;
    expect(within(sindico).getByText("Dona Marta")).toBeInTheDocument();
    expect(within(sindico).getByRole("link", { name: /Ligar para Síndico \(Dona Marta\)/ })).toHaveAttribute(
      "href",
      "tel:+5511999998888",
    );
    expect(within(sindico).getByRole("link", { name: /WhatsApp de Síndico/ })).toHaveAttribute(
      "href",
      "https://wa.me/5511999998888",
    );
    expect(within(sindico).getByText("marta@aurora.com.br")).toHaveClass("select-all");

    const portaria = screen.getByText("Portaria").closest("li") as HTMLElement;
    expect(within(portaria).getByRole("link", { name: /Ligar para Portaria/ })).toHaveAttribute("href", "tel:+551133334444");

    // 0800: liga, mas não tem WhatsApp.
    const adm = screen.getByText("Administradora").closest("li") as HTMLElement;
    expect(within(adm).getByRole("link", { name: /Ligar para Administradora/ })).toHaveAttribute("href", "tel:08001234567");
    expect(within(adm).queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();

    // Contato sem nada preenchido
    const gerente = screen.getByText("Gerente predial").closest("li") as HTMLElement;
    expect(within(gerente).getByText("Não informado")).toBeInTheDocument();
    expect(within(gerente).queryByRole("link")).not.toBeInTheDocument();
  });

  it("senha da fechadura fica escondida até tocar em Mostrar; dá para copiar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderSheet();
    expect(screen.queryByText("4321#")).not.toBeInTheDocument();
    expect(screen.getByText("••••••")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(screen.getByText("4321#")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(screen.queryByText("4321#")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copiar senha" }));
    expect(writeText).toHaveBeenCalledWith("4321#");
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Senha copiada"));
  });

  it("sem senha: diz que não há fechadura informada", () => {
    h.query = { data: ficha({ electronic_lock_password: null }) };
    renderSheet();
    expect(screen.getByText("Sem fechadura eletrônica informada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar" })).not.toBeInTheDocument();
  });

  it("avisa o que falta e marca os campos vazios como não informados", () => {
    h.query = {
      data: ficha({
        data_recebimento_chaves: null,
        keys_received_by: null,
        key_location: null,
        access_release_process: null,
        provider_access_instructions: null,
      }),
    };
    renderSheet();
    const aviso = screen.getByText("Faltam 2 informações nesta ficha").closest("p") as HTMLElement;
    expect(aviso).toHaveTextContent("Faltam 2 informações nesta ficha: Chaves, Como pedir a liberação da equipe.");
    expect(screen.getByText("Ainda não recebidas")).toBeInTheDocument();
    // Onde estão, liberação, acesso no dia e gerente predial
    expect(screen.getAllByText("Não informado")).toHaveLength(4);
  });

  it("obra ainda sem ficha: tudo por preencher, com o aviso", () => {
    h.query = { data: null };
    renderSheet();
    expect(screen.getByText("Faltam 5 informações nesta ficha")).toBeInTheDocument();
    expect(screen.getByText("Ainda não recebidas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir no mapa" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("editar e salvar manda só o que mudou", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const form = screen.getByRole("form", { name: "Editar ficha da obra" });
    expect(within(form).getByLabelText("Endereço")).toHaveValue("Rua Augusta, 1200");
    expect(within(form).getByLabelText("Recebidas em")).toHaveValue("2026-08-03");
    expect(within(form).getByLabelText("Senha")).toHaveValue("4321#");
    expect(within(form).getByRole("button", { name: "Segunda" })).toHaveAttribute("aria-pressed", "true");
    expect(within(form).getByRole("button", { name: "Sábado" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.change(within(form).getByLabelText("Quem recebeu"), { target: { value: "  Pedro  " } });
    fireEvent.change(within(form).getByLabelText("Onde estão"), { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: "Sábado" }));
    fireEvent.change(within(form).getByLabelText("Até"), { target: { value: "16:30" } });
    fireEvent.change(within(form).getByLabelText("Como pedir a liberação da equipe"), {
      target: { value: "Avisar a portaria na véspera." },
    });
    const gerente = within(form).getByRole("group", { name: "Gerente predial" });
    fireEvent.change(within(gerente).getByLabelText("Nome"), { target: { value: "Seu Jorge" } });
    fireEvent.change(within(gerente).getByLabelText("Telefone"), { target: { value: "(11) 98888-7777" } });

    fireEvent.click(within(form).getByRole("button", { name: "Salvar ficha" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      projectId: "p1",
      patch: {
        keys_received_by: "Pedro",
        key_location: null,
        allowed_work_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
        allowed_work_end_time: "16:30",
        access_release_process: "Avisar a portaria na véspera.",
        building_manager_name: "Seu Jorge",
        building_manager_phone: "(11) 98888-7777",
      },
    });
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Ficha salva"));
    // Volta para a leitura.
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("salvar sem mudar nada não grava e volta para a leitura", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("telefone inválido ou horário incompleto não salva e mostra o erro", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const form = screen.getByRole("form");
    const portaria = within(form).getByRole("group", { name: "Portaria" });
    fireEvent.change(within(portaria).getByLabelText("Telefone"), { target: { value: "3333-4444" } });
    fireEvent.change(within(form).getByLabelText("Até"), { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar ficha" }));

    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(within(portaria).getByText(/Use DDD \+ número/)).toBeInTheDocument();
    expect(within(form).getByText("Informe horário de início e término")).toBeInTheDocument();
    expect(within(form).getByText("Corrija os campos destacados para salvar.")).toBeInTheDocument();
  });

  it("dado antigo fora do padrão não impede de corrigir outro campo", async () => {
    // Telefone sem DDD e dias sem horário, gravados por outra tela.
    h.query = { data: ficha({ syndic_phone: "99999-8888", allowed_work_end_time: null }) };
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Onde estão"), { target: { value: "Com o zelador" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({ projectId: "p1", patch: { key_location: "Com o zelador" } }),
    );
  });

  it("se o salvar falhar, o formulário continua aberto com o que foi digitado", async () => {
    h.mutateAsync.mockRejectedValue(new Error("sem rede"));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Quem recebeu"), { target: { value: "Pedro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("form")).toBeInTheDocument();
    expect(screen.getByLabelText("Quem recebeu")).toHaveValue("Pedro");
    expect(h.success).not.toHaveBeenCalled();
  });

  it("cancelar descarta a edição", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Quem recebeu"), { target: { value: "Outra pessoa" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Recebidas em 03/08/2026 por Thiago")).toBeInTheDocument();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("quem não pode editar só lê", () => {
    h.canEdit = false;
    renderSheet();
    expect(screen.getByText("Recebidas em 03/08/2026 por Thiago")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("carregando: esqueleto, sem ficha vazia", () => {
    h.query = { data: undefined, isLoading: true };
    renderSheet();
    expect(screen.getByLabelText("Carregando a ficha da obra")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("erro ao carregar: avisa e oferece tentar de novo, nunca uma ficha em branco", () => {
    h.query = { data: undefined, isError: true };
    renderSheet();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar a ficha desta obra.");
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
    expect(screen.queryByText(/nesta ficha/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ainda não recebidas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it("falha ao atualizar com ficha já carregada: mostra a última versão e avisa", () => {
    h.query = { data: ficha(), isError: true };
    renderSheet();
    expect(screen.getByText("Recebidas em 03/08/2026 por Thiago")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando a última versão carregada/)).toBeInTheDocument();
  });

  it("fechada não mostra nada", () => {
    renderSheet({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
