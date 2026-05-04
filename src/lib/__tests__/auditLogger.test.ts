import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing auditLogger
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock("@/lib/errorLogger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { logAudit, audit } from "@/lib/auditLogger";
import { supabase } from "@/integrations/supabase/client";

describe("auditLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
  });

  it("logAudit inserts into auditoria", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await logAudit({
      action: "create",
      entityType: "project",
      entityId: "proj-1",
      after: { name: "Test" },
    });

    expect(supabase.from).toHaveBeenCalledWith("auditoria");
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        acao: "create",
        entidade: "project",
        entidade_id: "proj-1",
        por_user_id: "user-123",
      }),
    ]);
  });

  it("logAudit does nothing without user", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    const insertMock = vi.fn();
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await logAudit({
      action: "update",
      entityType: "test",
      entityId: "1",
    });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("audit.roleChanged sends correct diff", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await audit.roleChanged("user-1", ["customer"], ["engineer"]);

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        diff: { old: { roles: ["customer"] }, new: { roles: ["engineer"] } },
      }),
    ]);
  });
});
