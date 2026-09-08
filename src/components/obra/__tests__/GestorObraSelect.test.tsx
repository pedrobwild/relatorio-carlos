import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * O gestor da obra só existia em telas de cadastro que ninguém abre no dia a
 * dia — por isso "não aparecia em lugar nenhum" e o filtro por responsável
 * do Painel vinha zerado. Este componente é o controle que foi levado para
 * as telas de uso; os testes travam o que importa:
 *   1. staff vê, cliente não;
 *   2. gravar escreve UM id escalar na coluna única (nunca uma lista);
 *   3. limpar grava `null`, não string vazia;
 *   4. erro do banco desfaz a escolha otimista.
 */

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));
vi.mock("@/hooks/useStaffUsers", () => ({ useStaffUsers: vi.fn() }));
vi.mock("@/infra/repositories", () => ({
  projectsRepo: { setGestorObra: vi.fn() },
}));
vi.mock("@/lib/queryKeys", () => ({ invalidateProjectQueries: vi.fn() }));
vi.mock("@/lib/errorMonitoring", () => ({ captureError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { GestorObraSelect } from "@/components/obra/GestorObraSelect";
import { useUserRole } from "@/hooks/useUserRole";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { projectsRepo } from "@/infra/repositories";

const mockedRole = vi.mocked(useUserRole);
const mockedStaff = vi.mocked(useStaffUsers);
const mockedSet = vi.mocked(projectsRepo.setGestorObra);

const roleState = (isStaff: boolean) =>
  ({ isStaff, loading: false }) as unknown as ReturnType<typeof useUserRole>;

const staffState = () =>
  ({
    data: [
      { id: "u-ana", nome: "Ana", email: "ana@bwild.com.br", perfil: "gestor" },
      { id: "u-caio", nome: "Caio", email: "caio@bwild.com.br", perfil: "gestor" },
    ],
  }) as unknown as ReturnType<typeof useStaffUsers>;

describe("GestorObraSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRole.mockReturnValue(roleState(true));
    mockedStaff.mockReturnValue(staffState());
    mockedSet.mockResolvedValue({ data: null, error: null });
  });

  it("não renderiza nada para o cliente", () => {
    mockedRole.mockReturnValue(roleState(false));
    const { container } = render(
      <GestorObraSelect projectId="p1" gestorId={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("avisa o staff quando a obra está sem gestor", () => {
    render(<GestorObraSelect projectId="p1" gestorId={null} />);
    expect(screen.getByText(/Gestor da obra/i)).toBeInTheDocument();
    expect(
      screen.getByText(/não aparece em nenhum filtro por responsável/i),
    ).toBeInTheDocument();
  });

  it("mostra o gestor atual e some com o aviso", () => {
    render(<GestorObraSelect projectId="p1" gestorId="u-ana" />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(
      screen.queryByText(/não aparece em nenhum filtro/i),
    ).not.toBeInTheDocument();
  });

  it("grava um único id escalar — não existe segundo responsável", async () => {
    const onSaved = vi.fn();
    render(
      <GestorObraSelect projectId="p1" gestorId={null} onSaved={onSaved} />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Ana" }));

    await waitFor(() => expect(mockedSet).toHaveBeenCalledTimes(1));
    expect(mockedSet).toHaveBeenCalledWith("p1", "u-ana");
    expect(onSaved).toHaveBeenCalledWith("u-ana");

    // Trocar de gestor SUBSTITUI: continua uma chamada por escolha, sempre
    // com um id único como argumento — nunca um array.
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Caio" }));
    await waitFor(() => expect(mockedSet).toHaveBeenCalledTimes(2));
    expect(mockedSet).toHaveBeenLastCalledWith("p1", "u-caio");
    for (const [, valor] of mockedSet.mock.calls) {
      expect(Array.isArray(valor)).toBe(false);
    }
  });

  it("limpar o gestor grava null", async () => {
    render(<GestorObraSelect projectId="p1" gestorId="u-ana" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: /Sem gestor definido/i }),
    );
    await waitFor(() => expect(mockedSet).toHaveBeenCalledWith("p1", null));
  });

  it("erro do banco desfaz a escolha otimista", async () => {
    mockedSet.mockResolvedValue({
      data: null,
      error: { message: "rls" } as never,
    });
    render(<GestorObraSelect projectId="p1" gestorId={null} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Ana" }));

    await waitFor(() =>
      expect(
        screen.getByText(/não aparece em nenhum filtro por responsável/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });
});
