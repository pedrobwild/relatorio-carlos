import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useScheduleMeeting,
  type MeetingAvailability,
} from "@/hooks/useMeetingAvailability";
import { useAuth } from "@/hooks/useAuth";

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

interface AdminScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availability: MeetingAvailability;
}

export function AdminScheduleModal({
  open,
  onOpenChange,
  availability,
}: AdminScheduleModalProps) {
  const { user } = useAuth();
  const scheduleMeeting = useScheduleMeeting();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [meetingDetails, setMeetingDetails] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!selectedDate) errs.push("Selecione a data da reunião.");
    if (!selectedTime) errs.push("Informe o horário da reunião.");
    if (!meetingDetails.trim())
      errs.push("Cole os detalhes da reunião (Google Meet).");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = () => {
    if (!validate() || !user) return;

    // Build ISO datetime
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const dt = new Date(selectedDate!);
    dt.setHours(hours || 0, minutes || 0, 0, 0);

    scheduleMeeting.mutate(
      {
        availability_id: availability.id,
        stage_id: availability.stage_id,
        confirmed_datetime: dt.toISOString(),
        meeting_details_text: meetingDetails.trim(),
        confirmed_by: user.id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedDate(undefined);
          setSelectedTime("");
          setMeetingDetails("");
          setErrors([]);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Reunião de Briefing</DialogTitle>
          <DialogDescription>
            Revise as preferências do cliente e defina a data/hora da reunião.
          </DialogDescription>
        </DialogHeader>

        {/* Client preferences summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Preferências do cliente
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Intervalo</span>
              <p>
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
              <span className="text-xs text-muted-foreground">Horários</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {availability.time_slots.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {TIME_SLOTS_MAP[s] || s}
                  </Badge>
                ))}
              </div>
            </div>
            {availability.preferred_weekdays.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">
                  Dias preferidos
                </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
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
                <span className="text-xs text-muted-foreground">
                  Observações
                </span>
                <p className="text-muted-foreground">{availability.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Scheduling fields */}
        <div className="space-y-4">
          {/* Date picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Data da reunião
            </label>
            <Popover modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-11 min-h-[44px]",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {selectedDate
                    ? format(selectedDate, "dd 'de' MMMM yyyy", {
                        locale: ptBR,
                      })
                    : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    setSelectedDate(d);
                    setErrors([]);
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Horário
            </label>
            <Input
              type="time"
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setErrors([]);
              }}
              className="h-11 min-h-[44px]"
            />
          </div>

          {/* Meeting details textarea */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Detalhes da reunião (Google Meet)
            </label>
            <p className="text-xs text-muted-foreground">
              Cole o convite do Google Calendar exatamente como recebido.
            </p>
            <Textarea
              value={meetingDetails}
              onChange={(e) => {
                setMeetingDetails(e.target.value);
                setErrors([]);
              }}
              rows={8}
              className="text-sm font-mono"
              placeholder={
                "Pedro <> Rodrigo\nTerça-feira, 17 de fevereiro · 3:00 – 4:00pm\n\nComo participar do Google Meet\nLink da videochamada: https://meet.google.com/..."
              }
              maxLength={2000}
            />
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={scheduleMeeting.isPending}
            className="min-h-[44px] gap-2"
          >
            {scheduleMeeting.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Reunião agendada
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
