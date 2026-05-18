import { describe, it, expect, beforeEach } from "vitest";
import {
  rememberLastProjectId,
  getLastProjectId,
  clearLastProjectId,
} from "@/lib/lastProjectMemory";

describe("lastProjectMemory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists and restores the last visited projectId", () => {
    expect(getLastProjectId()).toBeUndefined();
    rememberLastProjectId("project-abc");
    expect(getLastProjectId()).toBe("project-abc");
  });

  it("ignores empty/null/undefined ids (does not clobber memory)", () => {
    rememberLastProjectId("project-abc");
    rememberLastProjectId(undefined);
    rememberLastProjectId(null);
    rememberLastProjectId("");
    expect(getLastProjectId()).toBe("project-abc");
  });

  it("clears the stored id", () => {
    rememberLastProjectId("project-xyz");
    clearLastProjectId();
    expect(getLastProjectId()).toBeUndefined();
  });

  it("sobrevive a um refresh: leitura inicial pega o valor persistido", () => {
    // Simula sessão anterior gravando o id.
    rememberLastProjectId("project-persisted");

    // Simula refresh — neste módulo o estado vive 100% no localStorage,
    // então a nova leitura logo após "reabrir o app" deve retornar o id.
    // (Se isso quebrar, o fallback do bottom nav deixa de funcionar
    // imediatamente após F5 em /obra/:id e antes do useEffect rodar.)
    const afterRefresh = getLastProjectId();
    expect(afterRefresh).toBe("project-persisted");
  });
});
