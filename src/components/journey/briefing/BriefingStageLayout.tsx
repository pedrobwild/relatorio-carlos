import { Separator } from '@/components/ui/separator';
import { StageSummary } from '../StageSummary';
import { StageIntroCard } from './StageIntroCard';
import { MeetingAvailabilityCard } from './MeetingAvailabilityCard';
import { AdminMeetingPanel } from './AdminMeetingPanel';
import { StageLogSection } from './StageLogSection';
import type { JourneyStage } from '@/hooks/useProjectJourney';

interface BriefingStageLayoutProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
}

export function BriefingStageLayout({ stage, projectId, isAdmin }: BriefingStageLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Summary header */}
      <StageSummary stage={stage} isExpanded={true} hideChevron />

      {/* ① StageIntroCard */}
      <StageIntroCard />

      {/* ② Meeting section — admin sees AdminMeetingPanel, client sees MeetingAvailabilityCard */}
      {isAdmin ? (
        <AdminMeetingPanel stageId={stage.id} projectId={projectId} />
      ) : (
        <MeetingAvailabilityCard stageId={stage.id} projectId={projectId} isAdmin={isAdmin} />
      )}

      <Separator />

      {/* ③ StageLogSection */}
      <StageLogSection
        stageId={stage.id}
        projectId={projectId}
        isAdmin={isAdmin}
        minutesOnly
        stageName={stage.name}
      />
    </div>
  );
}
