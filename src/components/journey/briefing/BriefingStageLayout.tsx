import { Separator } from '@/components/ui/separator';
import { StageSummary } from '../StageSummary';
import { StageIntroCard } from './StageIntroCard';
import { MeetingAvailabilityCard } from './MeetingAvailabilityCard';
import { MeetingConfirmationCard } from './MeetingConfirmationCard';
import { StageLogSection } from './StageLogSection';
import { useMeetingAvailability } from '@/hooks/useMeetingAvailability';
import type { JourneyStage } from '@/hooks/useProjectJourney';

interface BriefingStageLayoutProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
}

export function BriefingStageLayout({ stage, projectId, isAdmin }: BriefingStageLayoutProps) {
  const { data: availability } = useMeetingAvailability(stage.id, projectId);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <StageSummary stage={stage} isExpanded={true} hideChevron />

      {/* ① StageIntroCard */}
      <StageIntroCard />


      {/* ③ MeetingConfirmationCard (shown above availability when confirmed) */}
      {availability?.status === 'confirmed' && (
        <MeetingConfirmationCard availability={availability} />
      )}

      {/* ④ MeetingAvailabilityCard */}
      <MeetingAvailabilityCard
        stageId={stage.id}
        projectId={projectId}
        isAdmin={isAdmin}
      />

      <Separator />

      {/* ⑤ StageLogSection */}
      <StageLogSection
        stageId={stage.id}
        projectId={projectId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
