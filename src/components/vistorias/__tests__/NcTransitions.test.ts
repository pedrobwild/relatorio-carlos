import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit-tests for the NC transition orchestration logic.
 * We extract the sequencing contract into a pure-function helper
 * and verify the correct call order without rendering React components.
 */

// Minimal mock types matching the domain
type NcStatus =
  | "open"
  | "in_treatment"
  | "pending_verification"
  | "pending_approval"
  | "closed"
  | "reopened";

interface TransitionParams {
  ncId: string;
  projectId: string;
  newStatus: NcStatus;
  photosBefore: string[];
  photosAfter: string[];
  correctiveAction?: string;
  actionNotes?: string;
  rootCause?: string;
  actualCostInput?: string;
}

/**
 * Replicate the orchestration logic from NcDetailDialog.handleTransition
 * so we can test call ordering without React/DOM overhead.
 */
async function executeTransition(
  params: TransitionParams,
  deps: {
    saveEvidence: (p: {
      id: string;
      project_id: string;
      evidence_photos_before: string[];
      evidence_photos_after: string[];
    }) => Promise<void>;
    updateNc: (p: {
      id: string;
      project_id: string;
      root_cause?: string;
      actual_cost?: number | null;
    }) => Promise<void>;
    transitionStatus: (p: {
      newStatus: NcStatus;
      notes?: string;
      corrective_action?: string;
      resolution_notes?: string;
      evidence_photos_before?: string[];
      evidence_photos_after?: string[];
    }) => Promise<void>;
  },
) {
  // 1) Save evidence photos BEFORE transitioning
  await deps.saveEvidence({
    id: params.ncId,
    project_id: params.projectId,
    evidence_photos_before: params.photosBefore,
    evidence_photos_after: params.photosAfter,
  });

  // 2) For closing, save root_cause & actual_cost BEFORE transitioning
  if (params.newStatus === "closed") {
    await deps.updateNc({
      id: params.ncId,
      project_id: params.projectId,
      root_cause: params.rootCause,
      actual_cost: params.actualCostInput
        ? parseFloat(params.actualCostInput)
        : null,
    });
  }

  // 3) Transition status via RPC
  await deps.transitionStatus({
    newStatus: params.newStatus,
    notes: params.actionNotes,
    corrective_action:
      params.newStatus === "in_treatment" ? params.correctiveAction : undefined,
    resolution_notes:
      params.newStatus === "pending_verification"
        ? params.actionNotes
        : undefined,
    evidence_photos_before:
      params.photosBefore.length > 0 ? params.photosBefore : undefined,
    evidence_photos_after:
      params.photosAfter.length > 0 ? params.photosAfter : undefined,
  });
}

describe("NC Transition Orchestration", () => {
  const callOrder: string[] = [];
  const saveEvidence = vi.fn(async () => {
    callOrder.push("saveEvidence");
  });
  const updateNc = vi.fn(async () => {
    callOrder.push("updateNc");
  });
  const transitionStatus = vi.fn(async () => {
    callOrder.push("transitionStatus");
  });

  const deps = { saveEvidence, updateNc, transitionStatus };

  beforeEach(() => {
    callOrder.length = 0;
    vi.clearAllMocks();
  });

  it("saves evidence before status transition (open → in_treatment)", async () => {
    await executeTransition(
      {
        ncId: "nc-1",
        projectId: "proj-1",
        newStatus: "in_treatment",
        photosBefore: ["photo1.jpg"],
        photosAfter: [],
        correctiveAction: "Fix it",
      },
      deps,
    );

    expect(callOrder).toEqual(["saveEvidence", "transitionStatus"]);
    expect(saveEvidence).toHaveBeenCalledTimes(1);
    expect(updateNc).not.toHaveBeenCalled();
    expect(transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        newStatus: "in_treatment",
        corrective_action: "Fix it",
        evidence_photos_before: ["photo1.jpg"],
      }),
    );
  });

  it("saves evidence → updateNc → transition when closing", async () => {
    await executeTransition(
      {
        ncId: "nc-2",
        projectId: "proj-1",
        newStatus: "closed",
        photosBefore: ["before.jpg"],
        photosAfter: ["after.jpg"],
        rootCause: "Falha de material",
        actualCostInput: "1500",
        actionNotes: "Aprovado",
      },
      deps,
    );

    expect(callOrder).toEqual(["saveEvidence", "updateNc", "transitionStatus"]);
    expect(updateNc).toHaveBeenCalledWith(
      expect.objectContaining({
        root_cause: "Falha de material",
        actual_cost: 1500,
      }),
    );
    expect(transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        newStatus: "closed",
        evidence_photos_before: ["before.jpg"],
        evidence_photos_after: ["after.jpg"],
      }),
    );
  });

  it("does NOT call updateNc for non-closing transitions", async () => {
    await executeTransition(
      {
        ncId: "nc-3",
        projectId: "proj-1",
        newStatus: "pending_verification",
        photosBefore: [],
        photosAfter: ["after.jpg"],
        actionNotes: "Resolvido",
      },
      deps,
    );

    expect(callOrder).toEqual(["saveEvidence", "transitionStatus"]);
    expect(updateNc).not.toHaveBeenCalled();
    expect(transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        newStatus: "pending_verification",
        resolution_notes: "Resolvido",
      }),
    );
  });

  it("propagates saveEvidence errors and does NOT transition", async () => {
    const failingSave = vi.fn().mockRejectedValue(new Error("Storage error"));
    const failDeps = { saveEvidence: failingSave, updateNc, transitionStatus };

    await expect(
      executeTransition(
        {
          ncId: "nc-4",
          projectId: "proj-1",
          newStatus: "in_treatment",
          photosBefore: [],
          photosAfter: [],
          correctiveAction: "Fix",
        },
        failDeps,
      ),
    ).rejects.toThrow("Storage error");

    expect(transitionStatus).not.toHaveBeenCalled();
  });

  it("omits empty photo arrays from transition call", async () => {
    await executeTransition(
      {
        ncId: "nc-5",
        projectId: "proj-1",
        newStatus: "pending_approval",
        photosBefore: [],
        photosAfter: [],
      },
      deps,
    );

    expect(transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_photos_before: undefined,
        evidence_photos_after: undefined,
      }),
    );
  });
});
