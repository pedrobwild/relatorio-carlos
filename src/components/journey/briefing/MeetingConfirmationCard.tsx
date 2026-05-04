import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MeetingAvailability } from "@/hooks/useMeetingAvailability";

interface MeetingConfirmationCardProps {
  availability: MeetingAvailability;
}

export function MeetingConfirmationCard({
  availability,
}: MeetingConfirmationCardProps) {
  if (availability.status !== "confirmed" || !availability.confirmed_datetime)
    return null;

  const confirmedDate = new Date(availability.confirmed_datetime);

  return (
    <Card className="border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.03)]">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-[hsl(var(--success)/0.1)] flex items-center justify-center mt-0.5">
            <CalendarCheck className="h-4 w-4 text-[hsl(var(--success))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Reunião confirmada
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Esta reunião dá início ao desenvolvimento do seu Projeto 3D.
            </p>
          </div>
        </div>

        <div className="pl-11">
          <p className="text-sm font-medium text-foreground">
            {format(confirmedDate, "EEEE, dd 'de' MMMM 'às' HH:mm", {
              locale: ptBR,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
