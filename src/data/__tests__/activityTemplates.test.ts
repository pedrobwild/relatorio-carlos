import { describe, expect, it, vi } from "vitest";
import {
  activityTemplateSets,
  generateActivitiesFromTemplate,
} from "@/data/activityTemplates";

describe("generateActivitiesFromTemplate", () => {
  it("inicia na data da obra, respeita dias úteis e encadeia predecessoras", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("atividade-1")
        .mockReturnValueOnce("atividade-2"),
    });

    const template = {
      ...activityTemplateSets[0],
      activities: activityTemplateSets[0].activities.slice(0, 2),
    };
    const activities = generateActivitiesFromTemplate(
      template,
      new Date(2026, 8, 23),
    );

    expect(activities[0]).toMatchObject({
      id: "atividade-1",
      plannedStart: "2026-09-23",
      plannedEnd: "2026-09-25",
      predecessorIds: [],
    });
    expect(activities[1]).toMatchObject({
      id: "atividade-2",
      plannedStart: "2026-09-28",
      plannedEnd: "2026-10-02",
      predecessorIds: ["atividade-1"],
    });

    vi.unstubAllGlobals();
  });
});