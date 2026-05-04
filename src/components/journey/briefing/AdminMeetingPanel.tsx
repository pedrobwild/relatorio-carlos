import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useMeetingAvailability,
  deriveMeetingState,
  type BriefingMeetingState,
} from "@/hooks/useMeetingAvailability";
import { AdminScheduleModal } from "./AdminScheduleModal";
import { MeetingScheduledCard } from "./MeetingScheduledCard";

const WEEKDAYS_MAP: Record<string, string> = {
  MON: "Seg",
  TUE: "Ter",
  WED: "Qua",
  THU: "Qui",
  FRI: "Sex",
};
const TIME_SLOTS_MAP: Record<string, string> = {
  "09_12": "09:00–12:00",
  "13_18": "13:00–18:00",
  "18_20": "18:00–20:00",
};

const STATUS_BADGE: Record<
  BriefingMeetingState,
  { label: string; variant: "secondary" | "outline" | "default" }
> = {
  needs_availability: {
    label: "⏳ Aguardando disponibilidade",
    variant: "secondary",
  },
  awaiting_scheduling: {
    label: "📋 Aguardando agendamento",
    variant: "outline",
  },
  scheduled: { label: "✅ Agendada", variant: "default" },
};

interface AdminMeetingPanelProps {
  stageId: string;
  projectId: string;
}

export function AdminMeetingPanel({
  stageId,
  projectId,
}: AdminMeetingPanelProps) {
  const { data: availability, isLoading } = useMeetingAvailability(
    stageId,
    projectId,
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const state = deriveMeetingState(availability ?? null);
  const badge = STATUS_BADGE[state];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If scheduled, show the scheduled card (same as client)
  if (state === "scheduled" && availability) {
    return <MeetingScheduledCard availability={availability} />;
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Reunião de Briefing
                </h3>
                <Badge variant={badge.variant} className="mt-1.5 text-xs">
                  {badge.label}
                </Badge>
              </div>
            </div>
            {state === "awaiting_scheduling" && (
              <Button
                size="sm"
                className="h-10 min-h-[44px] gap-1.5"
                onClick={() => setScheduleOpen(true)}
              >
                <Clock className="h-3.5 w-3.5" />
                Agendar Reunião
              </Button>
            )}
          </div>

          {/* Show client preferences if available */}
          {availability && state === "awaiting_scheduling" && (
            <div className="grid gap-3 sm:grid-cols-2 pl-11">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Intervalo
                </p>
                <p className="text-sm mt-0.5">
                  {format(
                    new Date(availability.start_date + "T00:00:00"),
                    "dd MMM",
                    { locale: ptBR },
                  )}{" "}
                  –{" "}
                  {format(
                    new Date(availability.end_date + "T00:00:00"),
                    "dd MMM yyyy",
                    { locale: ptBR },
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Horários
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {availability.time_slots.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {TIME_SLOTS_MAP[s] || s}
                    </Badge>
                  ))}
                </div>
              </div>
              {availability.preferred_weekdays.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Dias preferidos
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {availability.preferred_weekdays.map((wd) => (
                      <Badge key={wd} variant="outline" className="text-xs">
                        {WEEKDAYS_MAP[wd] || wd}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {availability.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Observações
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {availability.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {state === "needs_availability" && (
            <p className="text-sm text-muted-foreground pl-11">
              O cliente ainda não registrou sua disponibilidade.
            </p>
          )}
        </CardContent>
      </Card>

      {availability && (
        <AdminScheduleModal
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          availability={availability}
        />
      )}
    </>
  );
}
