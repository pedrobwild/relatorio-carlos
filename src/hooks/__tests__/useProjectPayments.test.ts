import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("useProjectPayments - query key consistency", () => {
  it("uses centralized query keys for payments", () => {
    const key = queryKeys.payments.list("project-123");
    expect(key).toEqual(["project-payments", "list", "project-123"]);
  });

  it("payments.all is a prefix of payments.list", () => {
    const all = queryKeys.payments.all;
    const list = queryKeys.payments.list("p1");
    expect(list.slice(0, all.length)).toEqual([...all]);
  });
});
