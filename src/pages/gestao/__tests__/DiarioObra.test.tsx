/**
 * Diário de obra na tela: o caminho rápido do começo ao envio, a trava da
 * etapa impedida e o relato guardado sem sinal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DiarioPendente } from "@/lib/offline/diarioOutbox";

const h = vi.hoisted(() => ({
  online: true,
  enqueue: vi.fn(),
  discard: vi.fn(async () => undefined),
}));

vi.mock("browser-image-compression", () => ({ default: async (f: File) => f }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "carla@bwild.com.br", user_metadata: { display_name: "Carla Souza" } } }),
}));
vi.mock("@/hooks/useOpsOffline", () => ({ useIsOnline: () => h.online }));
vi.mock("@/lib/offline/diarioSync", () => ({
  getDiarioOutbox: () => ({ enqueue: h.enqueue, discard: h.discard, retry: vi.fn() }),
}));
vi.mock("@/hooks/useDiarioObra", () => {
  const etapa = (id: string, description: string, sortOrder: number) => ({
    id,
    description,
    plannedStart: "2020-01-01",
    plannedEnd: "2999-12-31",
    actualEnd: null,
    sortOrder,
  });
  const etapas = [etapa("e1", "Adequações elétricas", 1), etapa("e3", "Assentamento de piso", 3), etapa("e5", "Medição das bancadas", 5)];
  const obras = [
    { id: "o1", name: "Obra Alfa", unit_name: "42", budget_code: "1001", planned_start_date: "2026-11-02", actual_start_date: null },
    { id: "o2", name: "Obra Beta", unit_name: null, budget_code: null, planned_start_date: null, actual_start_date: null },
  ];
  return {
    useDiarioObras: () => ({ data: obras, isLoading: false, isError: false }),
    useDiarioEtapas: (id: string | null) => ({ etapas: id ? etapas : [], isLoading: false, isError: false }),
    useDiarioRelatos: () => ({ porEtapa: new Map(), isLoading: false }),
    useDiarioEquipe: () => ({ data: [{ user_id: "u9", name: "Rafa Lima" }] }),
    useDiarioItensMaterial: () => ({ data: [], isLoading: false }),
    useDiarioFornecedores: () => ({ data: [], isLoading: false, isError: false }),
    useDiarioFotos: () => ({ data: [], isLoading: false }),
    useSalvarTextoCliente: () => ({ mutate: vi.fn(), isPending: false }),
    useDiarioFila: () => ({ aguardando: [], recusados: [] }),
  };
});

import DiarioObra from "../DiarioObra";

const clicar = (nome: string | RegExp) => fireEvent.click(screen.getByRole("button", { name: nome }));
const tirarFoto = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
  await screen.findByText("Foto anexada · refazer");
};

beforeEach(() => {
  h.online = true;
  h.enqueue.mockReset().mockResolvedValue({ status: "enviado" });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  render(
    <MemoryRouter>
      <DiarioObra />
    </MemoryRouter>,
  );
});

describe("Diário de obra", () => {
  it("caminho rápido: obra, etapa em andamento com foto, equipe e envio", async () => {
    expect(screen.getByRole("heading", { name: "Quem e onde" })).toBeInTheDocument();
    expect(screen.getByText("Carla Souza")).toBeInTheDocument();

    clicar("Continuar");
    expect(screen.getByText("Escolha a obra para seguir.")).toBeInTheDocument();

    clicar(/Obra Alfa/);
    expect(screen.getByText("Ped. 1001 · Unid. 42")).toBeInTheDocument();
    clicar("Continuar");

    expect(screen.getByRole("heading", { name: "Etapas do dia" })).toBeInTheDocument();
    clicar(/Assentamento de piso/);
    clicar("Em andamento");
    clicar("Continuar");
    expect(screen.getByText("Foto da etapa: Assentamento de piso")).toBeInTheDocument();
    await tirarFoto();
    clicar("Continuar");

    expect(screen.getByRole("heading", { name: "Equipe" })).toBeInTheDocument();
    clicar("Mais uma pessoa");
    clicar("Mais uma pessoa");
    fireEvent.change(screen.getByLabelText("Nomes de quem esteve na obra"), { target: { value: "Ana, Beto" } });
    clicar("Continuar");

    expect(screen.getByRole("heading", { name: "Algo mais hoje?" })).toBeInTheDocument();
    clicar("Conferir e enviar");

    expect(screen.getByText("Tudo preenchido. Confira e envie.")).toBeInTheDocument();
    expect(screen.getByText("Nada a registrar")).toBeInTheDocument();
    clicar("Enviar relatório");

    await screen.findByText("Relato enviado");
    const enviado = h.enqueue.mock.calls[0][0] as DiarioPendente;
    expect(enviado).toMatchObject({ userId: "u1", projectId: "o1", projectName: "Obra Alfa" });
    expect(enviado.payload).toMatchObject({ project_id: "o1", team_count: 2, team_names: "Ana, Beto", reporter_function: "gestor" });
    expect(enviado.payload.etapas).toHaveLength(1);
    expect(enviado.payload.etapas[0]).toMatchObject({ item_id: "e3", status: "andamento" });
    expect(enviado.payload.etapas[0].texto_cliente).not.toMatch(/Ana|Beto/);
    expect(enviado.fotos).toHaveLength(1);
    expect(enviado.fotos[0]).toMatchObject({ id: enviado.payload.etapas[0].foto_id, kind: "etapa" });

    clicar("Relatar outra obra");
    expect(screen.getByRole("heading", { name: "Quem e onde" })).toBeInTheDocument();
  });

  it("etapa impedida: trava em Sim e não deixa voltar da pendência pela metade", async () => {
    clicar(/Obra Alfa/);
    clicar("Continuar");
    clicar(/Assentamento de piso/);
    clicar("Impedida");
    await tirarFoto();
    clicar("Continuar");
    clicar("Mais uma pessoa");
    fireEvent.change(screen.getByLabelText("Nomes de quem esteve na obra"), { target: { value: "Ana" } });
    clicar("Continuar");

    expect(screen.getByText("Travado em Sim: há etapa impedida marcada.")).toBeInTheDocument();
    clicar("Continuar");
    expect(screen.getByText("Vem da etapa impedida: Assentamento de piso")).toBeInTheDocument();

    clicar("Voltar");
    const aviso = await screen.findByRole("dialog");
    expect(within(aviso).getByText("Pendência incompleta")).toBeInTheDocument();
    fireEvent.click(within(aviso).getByRole("button", { name: "Voltar e preencher" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Pendência 1: responsável")).toBeInTheDocument();

    clicar("Falta material");
    clicar("Rafa Lima");
    clicar(/^Amanhã/);
    clicar("Sim, trava");
    clicar("Conferir e enviar");
    expect(screen.getByText("Tudo preenchido. Confira e envie.")).toBeInTheDocument();
    expect(screen.getByText("Trava a obra")).toBeInTheDocument();

    clicar("Enviar relatório");
    await screen.findByText("Relato enviado");
    expect((h.enqueue.mock.calls[0][0] as DiarioPendente).payload.pendencias).toEqual([
      expect.objectContaining({
        etapa_item_id: "e3",
        descricao: "Falta material",
        responsavel: "Rafa Lima",
        responsavel_user_id: "u9",
        trava_obra: true,
      }),
    ]);
  });

  it("sem sinal: o relato fica guardado no aparelho", async () => {
    h.online = false;
    h.enqueue.mockResolvedValue({ status: "na_fila" });
    clicar(/Obra Beta/);
    clicar("Continuar");
    clicar("Nenhuma etapa avançou hoje");
    clicar("Continuar");
    clicar("Continuar");
    clicar("Conferir e enviar");
    clicar("Salvar e enviar quando houver sinal");
    await screen.findByText("Salvo no aparelho");
    expect((h.enqueue.mock.calls[0][0] as DiarioPendente).payload).toMatchObject({ no_progress: true, sent_offline: true });
  });

  it("recusa do servidor: mostra o motivo e mantém o relato na tela", async () => {
    h.enqueue.mockResolvedValue({ status: "recusado", message: "A data do relato não pode ser futura" });
    clicar(/Obra Beta/);
    clicar("Continuar");
    clicar("Nenhuma etapa avançou hoje");
    clicar("Continuar");
    clicar("Continuar");
    clicar("Conferir e enviar");
    clicar("Enviar relatório");
    await screen.findByText("A data do relato não pode ser futura");
    expect(h.discard).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Conferir e enviar" })).toBeInTheDocument();
  });
});
