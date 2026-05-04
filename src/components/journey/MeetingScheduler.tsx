import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useMeetingSlots,
  useAddMeetingSlot,
  useDeleteMeetingSlot,
  useBookMeetingSlot,
} from "@/hooks/useMeetingSlots";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MeetingSchedulerProps {
  stageId: string;
  stageName: string;
  projectId: string;
  isAdmin: boolean;
  ctaText?: string;
}

const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

export function MeetingScheduler({
  stageId,
  stageName,
  projectId,
  isAdmin,
  ctaText = "Escolher data da reunião",
}: MeetingSchedulerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [isAddingSlot, setIsAddingSlot] = useState(false);

  const { project } = useProject();
  const { user } = useAuth();
  const { data: slots, isLoading } = useMeetingSlots(stageId);
  const addSlot = useAddMeetingSlot();
  const deleteSlot = useDeleteMeetingSlot();
  const bookSlot = useBookMeetingSlot();

  const availableSlots = slots?.filter((s) => !s.is_booked) || [];
  const bookedSlot = slots?.find((s) => s.is_booked);

  const handleAddSlot = () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Selecione data e horário");
      return;
    }

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const datetime = new Date(selectedDate);
    datetime.setHours(hours, minutes, 0, 0);

    addSlot.mutate(
      { stageId, slotDatetime: datetime.toISOString(), projectId },
      {
        onSuccess: () => {
          toast.success("Horário adicionado!");
          setSelectedDate(undefined);
          setSelectedTime(undefined);
          setIsAddingSlot(false);
        },
        onError: () => toast.error("Erro ao adicionar horário"),
      },
    );
  };

  const handleBookSlot = (slotId: string, slotDatetime: string) => {
    bookSlot.mutate(
      {
        slotId,
        projectId,
        projectName: project?.name || "Projeto",
        customerName: user?.email || "Cliente",
        customerEmail: user?.email || "",
        slotDatetime,
        stageName,
      },
      {
        onSuccess: () => {
          toast.success(
            "Reunião agendada com sucesso! A equipe foi notificada.",
          );
          setOpen(false);
        },
        onError: () => toast.error("Erro ao agendar reunião"),
      },
    );
  };

  // If already booked, show the booked date
  if (bookedSlot) {
    const bookedDate = new Date(bookedSlot.slot_datetime);
    return (
      <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
        <Check className="h-5 w-5 text-[hsl(var(--success))]" />
        <div>
          <p className="font-medium text-[hsl(var(--success))]">
            Reunião agendada
          </p>
          <p className="text-sm text-[hsl(var(--success))]">
            {format(bookedDate, "EEEE, d 'de' MMMM 'às' HH:mm", {
              locale: ptBR,
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <CalendarIcon className="h-4 w-4 mr-2" />
          {ctaText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAdmin
              ? "Gerenciar horários disponíveis"
              : "Escolher data da reunião"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Admin: Add new slots */}
              {isAdmin && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Adicionar horário
                    </span>
                    {!isAddingSlot && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingSlot(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Novo
                      </Button>
                    )}
                  </div>

                  {isAddingSlot && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1 justify-start",
                                !selectedDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate
                                ? format(selectedDate, "dd/MM/yyyy")
                                : "Data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              disabled={(date) =>
                                isBefore(date, startOfDay(new Date()))
                              }
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>

                        <Select
                          value={selectedTime}
                          onValueChange={setSelectedTime}
                        >
                          <SelectTrigger className="w-28">
                            <Clock className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Hora" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddSlot}
                          disabled={addSlot.isPending}
                        >
                          {addSlot.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Adicionar"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsAddingSlot(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Available slots list */}
              <div className="space-y-2">
                <span className="text-sm font-medium">
                  {isAdmin ? "Horários disponíveis" : "Escolha um horário"}
                </span>

                {availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {isAdmin
                      ? "Nenhum horário cadastrado. Adicione horários acima."
                      : "Aguarde a equipe disponibilizar os horários para agendamento."}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableSlots.map((slot) => {
                      const slotDate = new Date(slot.slot_datetime);
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div>
                            <p className="font-medium">
                              {format(slotDate, "EEEE, d 'de' MMMM", {
                                locale: ptBR,
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(slotDate, "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          {isAdmin ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                              onClick={() =>
                                deleteSlot.mutate({
                                  slotId: slot.id,
                                  projectId,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleBookSlot(slot.id, slot.slot_datetime)
                              }
                              disabled={bookSlot.isPending}
                            >
                              {bookSlot.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Agendar"
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
