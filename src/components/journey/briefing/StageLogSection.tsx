import { StageRegistry } from '../StageRegistry';

interface StageLogSectionProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
}

export function StageLogSection({ stageId, projectId, isAdmin }: StageLogSectionProps) {
  return (
    <section className="space-y-3">
      <StageRegistry stageId={stageId} projectId={projectId} isAdmin={isAdmin} />
    </section>
  );
}
