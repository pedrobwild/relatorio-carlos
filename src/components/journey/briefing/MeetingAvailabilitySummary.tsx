import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeetingAwaitingCard } from "./MeetingAwaitingCard";

const WEEKDAYS = [
  { key: "MON", label: "Seg" },
  { key: "TUE", label: "Ter" },
  { key: "WED", label: "Qua" },
  { key: "THU", label: "Qui" },
  { key: "FRI", label: "Sex" },
] as const;

const TIME_SLOTS = [
  { key: "09_12", label: "09:00–12:00" },
  { key: "13_18", label: "13:00–18:00" },
  { key: "18_20", label: "18:00–20:00" },
] as const;

interface MeetingAvailabilitySummaryProps {
  existing: {
    start_date: string;
    end_date: string;
    preferred_weekdays: string[];
    time_slots: string[];
    notes: string | null;
  };
  isAdmin: boolean;
  onEdit: () => void;
}

export function MeetingAvailabilitySummary({
  existing,
  isAdmin,
  onEdit,
}: MeetingAvailabilitySummaryProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Sua disponibilidade para a Reunião de Briefing
                </h3>
                <Badge variant="secondary" className="mt-1.5 text-xs">
                  ⏳ Aguardando agendamento
                </Badge>
              </div>
            </div>
            {!isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 gap-1.5 text-xs min-h-[44px] shrink-0"
                onClick={onEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pl-11">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Intervalo
              </p>
              <p className="text-sm mt-0.5">
                {format(new Date(existing.start_date + "T00:00:00"), "dd MMM", {
                  locale: ptBR,
                })}{" "}
                –{" "}
                {format(
                  new Date(existing.end_date + "T00:00:00"),
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
                {existing.time_slots.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {TIME_SLOTS.find((ts) => ts.key === s)?.label || s}
                  </Badge>
                ))}
              </div>
            </div>
            {existing.preferred_weekdays.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Dias preferidos
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {existing.preferred_weekdays.map((wd) => (
                    <Badge key={wd} variant="outline" className="text-xs">
                      {WEEKDAYS.find((w) => w.key === wd)?.label || wd}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {existing.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Observações
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {existing.notes}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <MeetingAwaitingCard />
    </div>
  );
}
