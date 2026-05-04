import { StageRegistry } from "../StageRegistry";

interface StageLogSectionProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
  minutesOnly?: boolean;
  stageName?: string;
}

export function StageLogSection({
  stageId,
  projectId,
  isAdmin,
  minutesOnly,
  stageName,
}: StageLogSectionProps) {
  return (
    <section className="space-y-3">
      <StageRegistry
        stageId={stageId}
        projectId={projectId}
        isAdmin={isAdmin}
        minutesOnly={minutesOnly}
        stageName={stageName}
      />
    </section>
  );
}
