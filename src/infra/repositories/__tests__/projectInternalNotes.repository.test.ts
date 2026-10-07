/**
 * Observações internas — o repositório não decide autoria nem sigilo (isso é
 * trigger + RLS no banco), mas precisa:
 *   1. nunca mandar author_id/author_name (o trigger preenche via auth.uid());
 *   2. esconder notas apagadas nas listagens;
 *   3. fixar/desafixar pela RPC (qualquer colaborador), não por UPDATE direto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const builder = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => builder),
  rpc: vi.fn(),
};

vi.mock("@/infra/supabase", () => ({ supabase: mockSupabase }));
vi.mock("../base.repository", async () => {
  const actual = await vi.importActual("../base.repository");
  return { ...(actual as object), supabase: mockSupabase };
});

const note = {
  id: "n1",
  project_id: "p1",
  author_id: "u1",
  author_name: "Ana",
  body: "Cliente viajando",
  category: "aguardando_cliente",
  is_pinned: true,
  edited_at: null,
  deleted_at: null,
  created_at: "2026-10-07T10:00:00Z",
  updated_at: "2026-10-07T10:00:00Z",
};

describe("projectInternalNotesRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(builder)) fn.mockReturnValue(builder);
    // Último elo das listagens: o 2º order resolve a query.
    builder.order
      .mockReturnValueOnce(builder)
      .mockResolvedValue({ data: [note], error: null });
    builder.single.mockResolvedValue({ data: note, error: null });
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("listByProject filtra a obra e esconde notas apagadas, fixada primeiro", async () => {
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    const result = await projectInternalNotesRepo.listByProject("p1");

    expect(mockSupabase.from).toHaveBeenCalledWith("project_internal_notes");
    expect(builder.eq).toHaveBeenCalledWith("project_id", "p1");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.order).toHaveBeenNthCalledWith(1, "is_pinned", {
      ascending: false,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([note]);
  });

  it("listPinned traz só fixadas e não apagadas", async () => {
    builder.order.mockReset();
    builder.order.mockResolvedValue({ data: [note], error: null });
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    await projectInternalNotesRepo.listPinned();

    expect(builder.eq).toHaveBeenCalledWith("is_pinned", true);
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("create não envia autoria e apara o texto", async () => {
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    await projectInternalNotesRepo.create({
      projectId: "p1",
      body: "  Aguardando material  ",
      category: "aguardando_material",
      pin: true,
    });

    expect(builder.insert).toHaveBeenCalledWith({
      project_id: "p1",
      body: "Aguardando material",
      category: "aguardando_material",
      is_pinned: true,
    });
    const payload = builder.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("author_id");
    expect(payload).not.toHaveProperty("author_name");
  });

  it("setPinned usa a RPC", async () => {
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    const result = await projectInternalNotesRepo.setPinned("n1", false);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "set_project_internal_note_pinned",
      { p_note_id: "n1", p_pinned: false },
    );
    expect(builder.update).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("setPinned propaga o erro do banco", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "denied", details: "", hint: "" },
    });
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    const result = await projectInternalNotesRepo.setPinned("n1", true);
    expect(result.error).not.toBeNull();
  });

  it("softDelete marca deleted_at em vez de apagar", async () => {
    const { projectInternalNotesRepo } = await import(
      "../projectInternalNotes.repository"
    );
    await projectInternalNotesRepo.softDelete("n1");

    const payload = builder.update.mock.calls[0][0];
    expect(typeof payload.deleted_at).toBe("string");
    expect(builder.eq).toHaveBeenCalledWith("id", "n1");
  });
});
