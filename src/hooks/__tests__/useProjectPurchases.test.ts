import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("useProjectPurchases - query key consistency", () => {
  it("uses centralized query keys for purchases", () => {
    const key = queryKeys.purchases.list("project-456");
    expect(key).toEqual(["project-purchases", "list", "project-456"]);
  });

  it("purchases.all is a prefix of purchases.list", () => {
    const all = queryKeys.purchases.all;
    const list = queryKeys.purchases.list("p1");
    expect(list.slice(0, all.length)).toEqual([...all]);
  });
});
