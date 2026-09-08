/**
 * Encerrar a fase de projeto — promoção NO LUGAR.
 *
 * Regressão que estes testes seguram (relato da Gabriella em 08/09,
 * #sugestoes-portal): concluir Mobilização clonava a obra num card novo sem
 * copiar a jornada, então a jornada era recriada do zero no Briefing e a obra
 * parecia ter "voltado para as etapas anteriores", com o cronograma dividido
 * entre dois cards. Agora a obra é promovida via RPC, na própria obra.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    get rpc() {
      return rpc;
    },
    get from() {
      return from;
    },
  },
}));

vi.mock("@/infra/supabase", () => ({
  supabase: {
    get rpc() {
      return rpc;
    },
    get from() {
      return from;
    },
  },
}));

import { promoteProjectToExecution } from "../projects.repository";

const PROJECT_ID = "5c79098d-0ef0-4b91-91e2-3314313f899f";
const STAGE_ID = "0f2b7d31-1111-2222-3333-444455556666";

describe("promoteProjectToExecution", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("promove pela RPC, passando etapa e data de início", async () => {
    const result = await promoteProjectToExecution(PROJECT_ID, {
      stageId: STAGE_ID,
      plannedStartDate: "2026-09-15",
    });

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("promote_project_to_execution", {
      p_project_id: PROJECT_ID,
      p_stage_id: STAGE_ID,
      p_planned_start_date: "2026-09-15",
    });
  });

  it("não cria obra nova — nenhum insert em projects", async () => {
    await promoteProjectToExecution(PROJECT_ID, {
      stageId: STAGE_ID,
      plannedStartDate: "2026-09-15",
    });

    // O clone antigo inseria um card novo e marcava o original como concluído.
    expect(from).not.toHaveBeenCalled();
  });

  it("funciona sem etapa e sem data (uso pelo banner de fim de fase)", async () => {
    await promoteProjectToExecution(PROJECT_ID);

    expect(rpc).toHaveBeenCalledWith("promote_project_to_execution", {
      p_project_id: PROJECT_ID,
      p_stage_id: undefined,
      p_planned_start_date: undefined,
    });
  });

  it("devolve o erro quando o banco recusa — nada de sucesso silencioso", async () => {
    // Era o buraco do `update` direto: o RLS barrava, voltava sem erro e com
    // zero linhas, e a UI dizia "Cronograma liberado" com a obra ainda presa.
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Sem permissão para encerrar a fase de projeto desta obra",
        details: "",
        hint: "",
        code: "P0001",
      },
    });

    const result = await promoteProjectToExecution(PROJECT_ID, {
      stageId: STAGE_ID,
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain("Sem permissão");
  });
});
