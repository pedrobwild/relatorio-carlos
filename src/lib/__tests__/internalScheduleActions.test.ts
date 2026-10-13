/** Ações rápidas: um lado que já tem a data nunca é sobrescrito. */
import { describe, it, expect } from "vitest";
import { finishTodayChange, startTodayChange } from "../internalScheduleActions";
import { resolveMirrorChange, type MirrorRow } from "@/hooks/useInternalSchedule";

const row = (p: Partial<MirrorRow> = {}): MirrorRow => ({
  actual_start: null,
  actual_end: null,
  planned_start: "2026-10-28",
  responsible_user_id: null,
  ...p,
});
const TODAY = "2026-11-05";

describe("startTodayChange", () => {
  it("sem início: hoje; com início: não toca", () => {
    expect(resolveMirrorChange(startTodayChange(TODAY), row())).toEqual({ actual_start: TODAY });
    expect(resolveMirrorChange(startTodayChange(TODAY), row({ actual_start: "2026-10-30" }))).toEqual({});
  });
});

describe("finishTodayChange", () => {
  it("Calendário: sem início usa o previsto da linha; início existente fica", () => {
    expect(resolveMirrorChange(finishTodayChange(TODAY, "planned_start"), row())).toEqual({
      actual_end: TODAY,
      actual_start: "2026-10-28",
    });
    expect(resolveMirrorChange(finishTodayChange(TODAY, "planned_start"), row({ actual_start: "2026-10-30" }))).toEqual({
      actual_end: TODAY,
    });
  });

  it("Lookahead: sem início usa hoje; lado já concluído não é tocado", () => {
    expect(resolveMirrorChange(finishTodayChange(TODAY, "today"), row())).toEqual({ actual_end: TODAY, actual_start: TODAY });
    expect(
      resolveMirrorChange(finishTodayChange(TODAY, "today"), row({ actual_start: "2026-10-30", actual_end: "2026-11-01" })),
    ).toEqual({});
  });
});
