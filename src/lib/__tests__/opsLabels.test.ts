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
