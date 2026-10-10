import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneyStepperCompact } from "@/components/journey/JourneyStepperCompact";
import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";

/**
 * O rótulo mostra a POSIÇÃO da etapa atual. Antes contava as concluídas:
 * cliente na 6ª etapa (Boas-vindas virtual + 6 do banco) lia "Etapa 5 de 7".
 */

const stage = (id: string, status: JourneyStageStatus) =>
  ({ id, name: id, status }) as JourneyStage;

function renderStepper(stages: JourneyStage[]) {
  return render(
    <JourneyStepperCompact
      stages={stages}
      activeStageId={null}
      onOpenTimeline={() => {}}
      onStageClick={() => {}}
    />,
  );
}

describe("JourneyStepperCompact", () => {
  it("mostra a posição da etapa atual (primeira não concluída)", () => {
    renderStepper([
      stage("welcome", "completed"),
      stage("Briefing", "completed"),
      stage("Projeto 3D", "completed"),
      stage("Medição Técnica", "completed"),
      stage("Projeto Executivo", "completed"),
      stage("Liberação da Obra", "in_progress"),
      stage("Mobilização", "pending"),
    ]);

    expect(screen.getByText("Etapa 6 de 7")).toBeInTheDocument();
    expect(screen.queryByText("Etapa 5 de 7")).not.toBeInTheDocument();
  });

  it("Boas-vindas em andamento conta como etapa 1", () => {
    renderStepper([
      stage("welcome", "in_progress"),
      stage("Briefing", "pending"),
      stage("Projeto 3D", "pending"),
    ]);

    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();
  });

  it("com todas concluídas mostra 'Todas as etapas concluídas'", () => {
    renderStepper([stage("welcome", "completed"), stage("A", "completed")]);

    expect(screen.getByText("Todas as etapas concluídas")).toBeInTheDocument();
    expect(screen.queryByText(/Etapa \d+ de/)).not.toBeInTheDocument();
  });
});
