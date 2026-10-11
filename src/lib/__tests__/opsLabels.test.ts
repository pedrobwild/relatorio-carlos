import { describe, expect, it } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import { OPS_MATERIAL_LABEL, OPS_REASON_LABEL, OPS_STATUS_LABEL, isOpsActivityClosed } from "../opsLabels";

describe("opsLabels", () => {
  it("tem rótulo para todo valor dos enums do banco", () => {
    const e = Constants.public.Enums;
    expect(Object.keys(OPS_STATUS_LABEL).sort()).toEqual([...e.ops_activity_status].sort());
    expect(Object.keys(OPS_REASON_LABEL).sort()).toEqual([...e.ops_block_reason].sort());
    expect(Object.keys(OPS_MATERIAL_LABEL).sort()).toEqual([...e.ops_material_status].sort());
  });
  it("atividades encerradas", () => {
    expect(isOpsActivityClosed("aprovada")).toBe(true);
    expect(isOpsActivityClosed("refazer")).toBe(true);
    expect(isOpsActivityClosed("em_execucao")).toBe(false);
    expect(isOpsActivityClosed("bloqueada")).toBe(false);
  });
});

import { applyOutcome } from "@/hooks/useOps";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

describe("applyOutcome (update otimista)", () => {
  const base = { id: "x", outcome: null, not_done_reason: null, notes: "antes", done_at: null } as unknown as OpsDayAssignment;
  const other = { ...base, id: "y" } as OpsDayAssignment;
  it("marca só a alocação certa e respeita o motivo", () => {
    const [x, y] = applyOutcome([base, other], { id: "x", outcome: "nao_feito", reason: "clima" }, "T") ?? [];
    expect(x).toMatchObject({ outcome: "nao_feito", not_done_reason: "clima", notes: "antes", done_at: "T" });
    expect(y).toBe(other);
  });
  it("feito limpa motivo; desfazer limpa carimbo", () => {
    const [x] = applyOutcome([{ ...base, not_done_reason: "clima" } as OpsDayAssignment], { id: "x", outcome: "feito", reason: "clima" }, "T") ?? [];
    expect(x).toMatchObject({ outcome: "feito", not_done_reason: null });
    const [z] = applyOutcome([x], { id: "x", outcome: null }, "T") ?? [];
    expect(z).toMatchObject({ outcome: null, done_at: null });
  });
});
