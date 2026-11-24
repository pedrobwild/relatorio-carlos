import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Observações internas da obra. Os testes travam o que importa:
 *   1. cliente não vê nada (o componente nem renderiza);
 *   2. qualquer colaborador (inclusive CS) lê e registra;
 *   3. a nota fixada aparece primeiro, como "Status atual";
 *   4. editar/remover só na própria nota — exceto admin/gestor.
 */

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useProjectInternalNotes", () => ({
  useProjectInternalNotes: vi.fn(),
  useCreateInternalNote: vi.fn(),
  useUpdateInternalNote: vi.fn(),
  useSetInternalNotePinned: vi.fn(),
  useDeleteInternalNote: vi.fn(),
}));

vi.mock("@/hooks/useInternalNoteMentions", () => ({
  useProjectNoteMentions: vi.fn(),
  useSetNoteMentions: vi.fn(),
  useResolveMention: vi.fn(),
}));
vi.mock("@/hooks/useStaffUsers", () => ({ useStaffUsers: vi.fn() }));

import { InternalNotesCard } from "@/components/internal-notes/InternalNotesCard";
import { useProjectNoteMentions, useResolveMention, useSetNoteMentions } from "@/hooks/useInternalNoteMentions";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import type { InternalNoteMention } from "@/infra/repositories/internalNoteMentions.repository";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import {
  useCreateInternalNote,
  useDeleteInternalNote,
  useProjectInternalNotes,
  useSetInternalNotePinned,
  useUpdateInternalNote,
} from "@/hooks/useProjectInternalNotes";

const mockedRole = vi.mocked(useUserRole);
const mockedAuth = vi.mocked(useAuth);
const mockedNotes = vi.mocked(useProjectInternalNotes);

const createMutate = vi.fn();
const pinMutate = vi.fn();
const setMentionsMutate = vi.fn();
const resolveMutate = vi.fn();

const mention = (over: Partial<InternalNoteMention> = {}): InternalNoteMention => ({
  id: "m1",
  note_id: "n-old",
  project_id: "p1",
  mentioned_user_id: "u-me",
  mentioned_name: "Carla CS",
  requested_by: "u-outro",
  requested_by_name: "Bruno Obras",
  created_at: "2026-10-05T10:00:00Z",
  resolved_at: null,
  resolved_by: null,
  resolved_by_name: null,
  resolution_note: null,
  archived_at: null,
  ...over,
});

const withMentions = (list: InternalNoteMention[]) => {
  const byNote = new Map<string, InternalNoteMention[]>();
  for (const m of list) byNote.set(m.note_id, [...(byNote.get(m.note_id) ?? []), m]);
  vi.mocked(useProjectNoteMentions).mockReturnValue({ byNote, isLoading: false });
};

const mutationState = (mutate = vi.fn()) =>
  ({ mutate, mutateAsync: vi.fn(), isPending: false }) as never;

const roleState = (roles: AppRole[]) =>
  ({
    roles,
    loading: false,
    isStaff: !roles.includes("customer"),
  }) as unknown as ReturnType<typeof useUserRole>;

const notes = [
  {
    id: "n-old",
    project_id: "p1",
    author_id: "u-outro",
    author_name: "Bruno Obras",
    body: "Vistoria remarcada.",
    category: "outro",
    is_pinned: false,
    edited_at: null,
    deleted_at: null,
    created_at: "2026-10-05T10:00:00Z",
    updated_at: "2026-10-05T10:00:00Z",
  },
  {
    id: "n-pin",
    project_id: "p1",
    author_id: "u-me",
    author_name: "Carla CS",
    body: "Sem atualização: cliente pediu para pausar até dia 15.",
    category: "obra_pausada",
    is_pinned: true,
    edited_at: null,
    deleted_at: null,
    created_at: "2026-10-06T10:00:00Z",
    updated_at: "2026-10-06T10:00:00Z",
  },
];

describe("InternalNotesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRole.mockReturnValue(roleState(["cs"]));
    mockedAuth.mockReturnValue({
      user: { id: "u-me" },
    } as unknown as ReturnType<typeof useAuth>);
    mockedNotes.mockReturnValue({
      data: notes,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectInternalNotes>);
    vi.mocked(useCreateInternalNote).mockReturnValue(mutationState(createMutate));
    vi.mocked(useUpdateInternalNote).mockReturnValue(mutationState());
    vi.mocked(useSetInternalNotePinned).mockReturnValue(mutationState(pinMutate));
    vi.mocked(useDeleteInternalNote).mockReturnValue(mutationState());
    withMentions([]);
    vi.mocked(useSetNoteMentions).mockReturnValue(mutationState(setMentionsMutate));
    vi.mocked(useResolveMention).mockReturnValue(mutationState(resolveMutate));
    vi.mocked(useStaffUsers).mockReturnValue({
      data: [
        { id: "u-me", nome: "Carla CS", email: "carla@b", perfil: "cs" },
        { id: "u-sergio", nome: "Sérgio Lima", email: "sergio@b", perfil: "suprimentos" },
        { id: "u-bia", nome: "Bia Souza", email: "bia@b", perfil: "engineer" },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useStaffUsers>);
  });

  it("não renderiza nada para o cliente", () => {
    mockedRole.mockReturnValue(roleState(["customer"]));
    const { container } = render(<InternalNotesCard projectId="p1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada enquanto o papel carrega", () => {
    mockedRole.mockReturnValue({
      roles: [],
      loading: true,
      isStaff: false,
    } as unknown as ReturnType<typeof useUserRole>);
    const { container } = render(<InternalNotesCard projectId="p1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o selo 'Só equipe' e a fixada primeiro como status atual", () => {
    render(<InternalNotesCard projectId="p1" />);

    expect(screen.getByText("Só equipe")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Status atual")).toBeInTheDocument();
    expect(
      within(items[0]).getByText(/cliente pediu para pausar/),
    ).toBeInTheDocument();
    expect(within(items[0]).getByText("Obra pausada")).toBeInTheDocument();
    expect(within(items[1]).getByText("Vistoria remarcada.")).toBeInTheDocument();
  });

  it("CS registra uma observação fixada como status atual", async () => {
    const user = userEvent.setup();
    render(<InternalNotesCard projectId="p1" />);

    await user.type(
      screen.getByLabelText("Nova observação interna"),
      "Aguardando o cliente escolher o piso.",
    );
    await user.click(screen.getByRole("button", { name: /registrar/i }));

    expect(createMutate).toHaveBeenCalledWith(
      {
        projectId: "p1",
        body: "Aguardando o cliente escolher o piso.",
        category: "sem_atualizacao",
        pin: true,
      },
      expect.any(Object),
    );
  });

  it("não registra texto vazio", async () => {
    render(<InternalNotesCard projectId="p1" />);
    expect(screen.getByRole("button", { name: /registrar/i })).toBeDisabled();
  });

  it("na nota de outro autor, colaborador comum só pode fixar", async () => {
    const user = userEvent.setup();
    render(<InternalNotesCard projectId="p1" />);

    const items = screen.getAllByRole("listitem");
    await user.click(
      within(items[1]).getByRole("button", { name: "Ações da observação" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /fixar como status atual/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /editar/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /remover/i })).toBeNull();

    await user.click(
      screen.getByRole("menuitem", { name: /fixar como status atual/i }),
    );
    expect(pinMutate).toHaveBeenCalledWith({ id: "n-old", pinned: true });
  });

  it("na própria nota, o autor pode editar e remover", async () => {
    const user = userEvent.setup();
    render(<InternalNotesCard projectId="p1" />);

    const items = screen.getAllByRole("listitem");
    await user.click(
      within(items[0]).getByRole("button", { name: "Ações da observação" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /editar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remover/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /desafixar/i })).toBeInTheDocument();
  });

  it("gestor pode editar e remover nota de outro autor", async () => {
    mockedRole.mockReturnValue(roleState(["gestor"]));
    const user = userEvent.setup();
    render(<InternalNotesCard projectId="p1" />);

    const items = screen.getAllByRole("listitem");
    await user.click(
      within(items[1]).getByRole("button", { name: "Ações da observação" }),
    );

    expect(
      await screen.findByRole("menuitem", { name: /editar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remover/i })).toBeInTheDocument();
  });

  it("edição em andamento sobrevive quando a nota perde a fixação", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InternalNotesCard projectId="p1" />);

    const items = screen.getAllByRole("listitem");
    await user.click(
      within(items[0]).getByRole("button", { name: "Ações da observação" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /editar/i }));
    const editor = screen.getByLabelText("Editar observação");
    await user.clear(editor);
    await user.type(editor, "Texto ainda não salvo");

    // Outro colaborador fixa uma nota nova: a minha desce para a lista.
    mockedNotes.mockReturnValue({
      data: [
        {
          ...notes[0],
          id: "n-new",
          body: "Nova fixada",
          is_pinned: true,
          created_at: "2026-10-07T10:00:00Z",
        },
        { ...notes[1], is_pinned: false },
        { ...notes[0], is_pinned: false },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectInternalNotes>);
    rerender(<InternalNotesCard projectId="p1" />);

    expect(screen.getByLabelText("Editar observação")).toHaveValue(
      "Texto ainda não salvo",
    );
  });

  it("mostra estado vazio", () => {
    mockedNotes.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectInternalNotes>);
    render(<InternalNotesCard projectId="p1" />);
    expect(
      screen.getByText("Nenhuma observação interna registrada."),
    ).toBeInTheDocument();
  });

  describe("menções", () => {
    it("marca alguém da equipe pela lista e avisa depois de registrar", async () => {
      const user = userEvent.setup();
      render(<InternalNotesCard projectId="p1" />);

      await user.click(screen.getByRole("button", { name: /Marcar alguém/ }));
      const lista = await screen.findByRole("dialog");
      // Quem escreve não marca a si mesmo.
      expect(within(lista).queryByRole("button", { name: "Carla CS" })).not.toBeInTheDocument();
      await user.type(within(lista).getByLabelText("Buscar pessoa da equipe"), "sergio");
      expect(within(lista).queryByRole("button", { name: "Bia Souza" })).not.toBeInTheDocument();
      await user.click(within(lista).getByRole("button", { name: "Sérgio Lima" }));

      const campo = screen.getByLabelText("Nova observação interna") as HTMLTextAreaElement;
      expect(campo.value).toBe("@Sérgio Lima ");
      expect(screen.getByText("Avisa: Sérgio Lima")).toBeInTheDocument();

      await user.type(campo, "falta o porcelanato");
      await user.click(screen.getByRole("button", { name: /Registrar/ }));

      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "p1", body: "@Sérgio Lima falta o porcelanato" }),
        expect.anything(),
      );
      // Só marca depois que a observação existe.
      expect(setMentionsMutate).not.toHaveBeenCalled();
      createMutate.mock.calls[0][1].onSuccess({ id: "n-nova" });
      expect(setMentionsMutate).toHaveBeenCalledWith({ noteId: "n-nova", userIds: ["u-sergio"] });
    });

    it("digitar @ abre a lista já filtrada", async () => {
      const user = userEvent.setup();
      render(<InternalNotesCard projectId="p1" />);
      await user.type(screen.getByLabelText("Nova observação interna"), "Obra parada @");
      const lista = await screen.findByRole("dialog");
      await user.click(within(lista).getByRole("button", { name: "Bia Souza" }));
      expect((screen.getByLabelText("Nova observação interna") as HTMLTextAreaElement).value).toBe(
        "Obra parada @Bia Souza ",
      );
    });

    it("apagar o @Nome do texto desfaz a marcação", async () => {
      const user = userEvent.setup();
      render(<InternalNotesCard projectId="p1" />);
      await user.click(screen.getByRole("button", { name: /Marcar alguém/ }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sérgio Lima" }));
      const campo = screen.getByLabelText("Nova observação interna");
      await user.clear(campo);
      await user.type(campo, "sem marcação");
      await user.click(screen.getByRole("button", { name: /Registrar/ }));
      createMutate.mock.calls[0][1].onSuccess({ id: "n-nova" });
      expect(setMentionsMutate).not.toHaveBeenCalled();
    });

    it("quem foi marcado vê a pendência atrasada e resolve com resposta", async () => {
      const user = userEvent.setup();
      withMentions([mention()]);
      render(<InternalNotesCard projectId="p1" />);

      expect(screen.getByText(/Atrasada · aberta/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Resolver" }));
      const gaveta = await screen.findByRole("dialog");
      expect(within(gaveta).getByText("Vistoria remarcada.")).toBeInTheDocument();
      await user.type(within(gaveta).getByLabelText("Resposta (opcional)"), "Remarcada para sexta.");
      await user.click(within(gaveta).getByRole("button", { name: "Marcar como resolvida" }));

      expect(resolveMutate).toHaveBeenCalledWith(
        { mentionId: "m1", resposta: "Remarcada para sexta." },
        expect.anything(),
      );
    });

    it("quem não foi marcado não vê o botão Resolver", () => {
      withMentions([mention({ mentioned_user_id: "u-sergio", mentioned_name: "Sérgio Lima" })]);
      render(<InternalNotesCard projectId="p1" />);
      expect(screen.getByText("Sérgio Lima")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    });

    it("mostra quem resolveu, quando e a resposta", () => {
      withMentions([
        mention({
          mentioned_user_id: "u-sergio",
          mentioned_name: "Sérgio Lima",
          resolved_at: "2026-10-06T14:00:00Z",
          resolved_by: "u-sergio",
          resolved_by_name: "Sérgio Lima",
          resolution_note: "Chega quinta.",
        }),
      ]);
      render(<InternalNotesCard projectId="p1" />);
      expect(screen.getByText(/Resolvida por Sérgio Lima em .*: Chega quinta\./)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    });
  });
});
