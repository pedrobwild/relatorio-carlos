/**
 * Tests for Auditoria Repository
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockLimit = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    gte: mockGte.mockReturnThis(),
    lte: mockLte.mockReturnThis(),
    or: mockOr.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    range: mockRange.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
  })),
};

vi.mock("@/infra/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual("../base.repository");
  return {
    ...(actual as object),
    supabase: mockSupabase,
  };
});

describe("Auditoria Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("listAudits", () => {
    it("should build query with default pagination", async () => {
      const { listAudits } = await import("../auditoria.repository");

      await listAudits({});

      expect(mockSupabase.from).toHaveBeenCalledWith("auditoria");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockRange).toHaveBeenCalledWith(0, 19); // page 1, pageSize 20
    });

    it("should apply obra_id filter when provided", async () => {
      const { listAudits } = await import("../auditoria.repository");
      const obraId = "test-obra-id";

      await listAudits({ obra_id: obraId });

      expect(mockEq).toHaveBeenCalledWith("obra_id", obraId);
    });

    it("should apply acao filter when provided", async () => {
      const { listAudits } = await import("../auditoria.repository");

      await listAudits({ acao: "create" });

      expect(mockEq).toHaveBeenCalledWith("acao", "create");
    });

    it("should apply date range filters", async () => {
      const { listAudits } = await import("../auditoria.repository");
      const dateFrom = "2024-01-01";
      const dateTo = "2024-12-31";

      await listAudits({ date_from: dateFrom, date_to: dateTo });

      expect(mockGte).toHaveBeenCalledWith("created_at", dateFrom);
      expect(mockLte).toHaveBeenCalledWith("created_at", dateTo);
    });

    it("should apply search filter with ilike", async () => {
      const { listAudits } = await import("../auditoria.repository");

      await listAudits({ search: "test" });

      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining("test"));
    });
  });

  describe("getEntityAuditTrail", () => {
    it("should query by entity type and id", async () => {
      const { getEntityAuditTrail } = await import("../auditoria.repository");

      await getEntityAuditTrail("documents", "doc-123", 5);

      expect(mockSupabase.from).toHaveBeenCalledWith("auditoria");
      expect(mockEq).toHaveBeenCalledWith("entidade", "documents");
      expect(mockEq).toHaveBeenCalledWith("entidade_id", "doc-123");
      expect(mockLimit).toHaveBeenCalledWith(5);
    });
  });

  describe("formatAuditsForCSV", () => {
    it("should format audits to CSV string", async () => {
      const { formatAuditsForCSV } = await import("../auditoria.repository");

      const audits = [
        {
          id: "1",
          acao: "create" as const,
          entidade: "documents",
          entidade_id: "doc-1",
          obra_id: "obra-1",
          created_at: "2024-01-15T10:30:00Z",
          diff: null,
          por_user_id: "user-1",
          users_profile: { nome: "João", email: "joao@test.com" },
        },
      ];

      const csv = formatAuditsForCSV(audits);

      expect(csv).toContain("Data/Hora");
      expect(csv).toContain("Usuário");
      expect(csv).toContain("Ação");
      expect(csv).toContain("João");
      expect(csv).toContain("Criação");
      expect(csv).toContain("documents");
    });

    it("should handle missing user profile", async () => {
      const { formatAuditsForCSV } = await import("../auditoria.repository");

      const audits = [
        {
          id: "1",
          acao: "update" as const,
          entidade: "obras",
          entidade_id: "obra-1",
          obra_id: null,
          created_at: "2024-01-15T10:30:00Z",
          diff: null,
          por_user_id: "user-1",
          users_profile: null,
        },
      ];

      const csv = formatAuditsForCSV(audits);

      expect(csv).toContain("user-1"); // Falls back to user_id
    });
  });
});
