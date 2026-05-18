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
});
