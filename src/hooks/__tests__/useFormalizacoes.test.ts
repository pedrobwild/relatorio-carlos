import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("useFormalizacoes - query key consistency", () => {
  it("uses centralized query keys for formalizacoes list", () => {
    const key = queryKeys.formalizacoes.list({
      projectId: "p1",
      status: "draft",
    });
    expect(key[0]).toBe("formalizacoes");
    expect(key[1]).toBe("list");
    expect(key[2]).toEqual({ projectId: "p1", status: "draft" });
  });

  it("formalizacoes.detail generates correct key", () => {
    const key = queryKeys.formalizacoes.detail("f1");
    expect(key).toEqual(["formalizacoes", "detail", "f1"]);
  });

  it("formalizacoes.all is a prefix of all sub-keys", () => {
    const all = queryKeys.formalizacoes.all;
    const list = queryKeys.formalizacoes.list();
    const detail = queryKeys.formalizacoes.detail("x");
    expect(list.slice(0, all.length)).toEqual([...all]);
    expect(detail.slice(0, all.length)).toEqual([...all]);
  });
});
