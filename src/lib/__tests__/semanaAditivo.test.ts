import { describe, it, expect } from "vitest";
import {
  AMENDMENT_NEXT_STATUS,
  AMENDMENT_REASON_FROM_OPS,
  amendmentCandidates,
  amendmentDescription,
  amendmentsInWeek,
  clampAmendmentDays,
} from "../semanaAditivo";
import type { OpsAssignment } from "@/infra/repositories/ops.repository";

const MON = "2026-10-05";
const nd = (id: string, work_date: string, reason: OpsAssignment["not_done_reason"], extra: Partial<OpsAssignment> = {}) =>
  ({ id, activity_id: "a1", work_date, not_done_reason: reason, photo_paths: null, ...extra }) as OpsAssignment;
const titles: Record<string, string> = { a1: "Passar conduíte", a2: "Massa corrida", a3: "Rodapé", a4: "Box" };
const titleOf = (id: string) => titles[id] ?? "Atividade";

describe("amendmentCandidates", () => {
  it("agrupa por motivo, conta dias distintos e junta fotos sem repetir", () => {
    const out = amendmentCandidates(
      [
        nd("1", "2026-10-06", "cliente_decisao", { photo_paths: ["x.jpg"] }),
        nd("2", "2026-10-05", "cliente_decisao", { activity_id: "a2", photo_paths: ["x.jpg", "y.jpg"] }),
        nd("3", "2026-10-05", "cliente_decisao"), // mesmo dia, outra pessoa
      ],
      titleOf,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      opsReason: "cliente_decisao",
      reason: "cliente_decisao",
      likelyExternal: true,
      days: 2,
      firstDate: "2026-10-05",
      dates: ["2026-10-05", "2026-10-06"],
      activityTitles: ["Massa corrida", "Passar conduíte"],
      photoPaths: ["x.jpg", "y.jpg"],
    });
  });

  it("deixa de fora 'Faltou equipe' e dia sem motivo", () => {
    expect(amendmentCandidates([nd("1", MON, "equipe"), nd("2", MON, null)], titleOf)).toEqual([]);
  });

  it("prováveis externos primeiro; depois mais dias", () => {
    const out = amendmentCandidates(
      [
        nd("1", "2026-10-05", "material"),
        nd("2", "2026-10-06", "material"),
        nd("3", "2026-10-07", "material"),
        nd("4", "2026-10-05", "clima"),
        nd("5", "2026-10-05", "condominio"),
        nd("6", "2026-10-06", "condominio"),
      ],
      titleOf,
    );
    expect(out.map((c) => c.opsReason)).toEqual(["condominio", "clima", "material"]);
  });

  it("mapeia o motivo do dia para o motivo do aditivo", () => {
    expect(AMENDMENT_REASON_FROM_OPS).toMatchObject({
      clima: "forca_maior",
      projeto: "projeto_terceiros",
      material: "cliente_fornecimento",
      equipe: null,
    });
  });
});

describe("amendmentDescription", () => {
  it("resume semana, dias, atividades e motivo, sem nomes", () => {
    const [c] = amendmentCandidates(
      [
        nd("1", "2026-10-05", "condominio", { activity_id: "a1" }),
        nd("2", "2026-10-06", "condominio", { activity_id: "a2" }),
        nd("3", "2026-10-07", "condominio", { activity_id: "a3" }),
        nd("4", "2026-10-08", "condominio", { activity_id: "a4" }),
      ],
      titleOf,
    );
    expect(amendmentDescription(c, MON)).toBe(
      "Semana de 05/10 a 09/10: 4 dias sem execução (05/10, 06/10, 07/10, 08/10) em Passar conduíte, Massa corrida, Rodapé e mais 1 — Condomínio.",
    );
  });

  it("singular", () => {
    const [c] = amendmentCandidates([nd("1", "2026-10-07", "clima")], titleOf);
    expect(amendmentDescription(c, MON)).toBe("Semana de 05/10 a 09/10: 1 dia sem execução (07/10) em Passar conduíte — Clima.");
  });
});

describe("amendmentsInWeek / clampAmendmentDays / próximos status", () => {
  it("filtra pelo evento entre segunda e domingo", () => {
    const rows = [{ event_date: "2026-10-04" }, { event_date: MON }, { event_date: "2026-10-11" }, { event_date: "2026-10-12" }];
    expect(amendmentsInWeek(rows, MON).map((r) => r.event_date)).toEqual([MON, "2026-10-11"]);
  });

  it("dias entre 1 e 30", () => {
    expect(clampAmendmentDays(0)).toBe(1);
    expect(clampAmendmentDays(2.4)).toBe(2);
    expect(clampAmendmentDays(99)).toBe(30);
    expect(clampAmendmentDays(Number.NaN)).toBe(1);
  });

  it("aceito é final", () => {
    expect(AMENDMENT_NEXT_STATUS.aceito).toEqual([]);
    expect(AMENDMENT_NEXT_STATUS.rascunho).toEqual(["enviado"]);
  });
});
