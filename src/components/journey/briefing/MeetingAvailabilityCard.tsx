import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useMeetingAvailability,
  deriveMeetingState,
} from "@/hooks/useMeetingAvailability";
import { MeetingScheduledCard } from "./MeetingScheduledCard";
import { MeetingAvailabilitySummary } from "./MeetingAvailabilitySummary";
import { MeetingAvailabilityForm } from "./MeetingAvailabilityForm";

interface MeetingAvailabilityCardProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
}

export function MeetingAvailabilityCard({
  stageId,
  projectId,
  isAdmin,
}: MeetingAvailabilityCardProps) {
  const { data: existing, isLoading } = useMeetingAvailability(
    stageId,
    projectId,
  );
  const [isEditing, setIsEditing] = useState(false);
  const meetingState = deriveMeetingState(existing ?? null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (meetingState === "scheduled" && existing) {
    return <MeetingScheduledCard availability={existing} />;
  }

  if (meetingState === "awaiting_scheduling" && existing && !isEditing) {
    return (
      <MeetingAvailabilitySummary
        existing={existing}
        isAdmin={isAdmin}
        onEdit={() => setIsEditing(true)}
      />
    );
  }

  return (
    <MeetingAvailabilityForm
      stageId={stageId}
      projectId={projectId}
      isEditing={isEditing}
      onCancel={() => setIsEditing(false)}
      onSuccess={() => setIsEditing(false)}
      initialData={isEditing && existing ? existing : undefined}
    />
  );
}
