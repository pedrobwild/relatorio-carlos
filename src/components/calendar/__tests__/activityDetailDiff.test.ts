/** Diálogo de detalhes do Calendário: só grava o que mudou desde que abriu. */
import { describe, it, expect } from "vitest";
import { changedDetailFields } from "../activityDetailDiff";

describe("changedDetailFields", () => {
  const opened = { actual_start: null, actual_end: null, responsible_user_id: "u1" };

  it("mudou só o término: não manda início nem responsável", () => {
    expect(changedDetailFields(opened, { ...opened, actual_end: "2026-11-05" })).toEqual({ actual_end: "2026-11-05" });
  });

  it("nada mudou: nada a gravar; limpar um campo manda null só nele", () => {
    expect(changedDetailFields(opened, opened)).toEqual({});
    expect(changedDetailFields(opened, { ...opened, responsible_user_id: null })).toEqual({ responsible_user_id: null });
  });
});
