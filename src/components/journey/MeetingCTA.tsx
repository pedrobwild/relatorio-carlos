import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { journeyCopy } from "@/constants/journeyCopy";
import {
  useStageDates,
  useCreateStageDate,
  useProposeStageDate,
  useConfirmStageDate,
} from "@/hooks/useStageDates";

function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-[110px] text-sm font-mono"
      aria-label={journeyCopy.dates.form.timeLabel}
    />
  );
}

function buildISO(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

interface MeetingCTAProps {
  stageId: string;
  stageName: string;
  projectId: string;
  isAdmin: boolean;
  ctaText?: string;
}

export function MeetingCTA({
  stageName,
  projectId,
  isAdmin,
  ctaText,
}: MeetingCTAProps) {
  const stageKey = stageName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
  const { data: dates, isLoading } = useStageDates(projectId, stageKey);
  const createDate = useCreateStageDate(projectId);
  const propose = useProposeStageDate(projectId);
  const confirm = useConfirmStageDate(projectId);

  const [mode, setMode] = useState<"idle" | "propose" | "confirm">("idle");
  const [pickerDate, setPickerDate] = useState<Date | undefined>();
  const [pickerTime, setPickerTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const meetingDate = dates?.find((d) => d.date_type === "meeting");

  const isConfirmed = !!meetingDate?.bwild_confirmed_at;
  const isProposed = !!meetingDate?.customer_proposed_at && !isConfirmed;
  const isPending =
    propose.isPending || confirm.isPending || createDate.isPending;

  const handleOpenPropose = () => {
    if (meetingDate?.customer_proposed_at) {
      setPickerDate(parseISO(meetingDate.customer_proposed_at));
      setPickerTime(
        format(parseISO(meetingDate.customer_proposed_at), "HH:mm"),
      );
    } else {
      setPickerDate(undefined);
      setPickerTime("09:00");
    }
    setNotes("");
    setMode("propose");
  };

  const handleOpenConfirm = () => {
    const ref =
      meetingDate?.customer_proposed_at || meetingDate?.bwild_confirmed_at;
    if (ref) {
      setPickerDate(parseISO(ref));
      setPickerTime(format(parseISO(ref), "HH:mm"));
    } else {
      setPickerDate(undefined);
      setPickerTime("09:00");
    }
    setNotes("");
    setMode("confirm");
  };

  const handleSubmit = async () => {
    if (!pickerDate) return;
    const iso = buildISO(pickerDate, pickerTime);

    const errorHandler = {
      onError: () => {
        toast.error(journeyCopy.errors.save_date, {
          action: { label: journeyCopy.errors.retry, onClick: handleSubmit },
        });
      },
    };

    if (!meetingDate) {
      const title = ctaText || `Reunião - ${stageName}`;
      createDate.mutate(
        {
          stage_key: stageKey,
          date_type: "meeting",
          title,
          customer_proposed_at: iso,
          notes: notes || undefined,
        },
        { onSuccess: () => setMode("idle"), ...errorHandler },
      );
      return;
    }

    if (mode === "propose") {
      propose.mutate(
        {
          stage_date_id: meetingDate.id,
          datetime: iso,
          notes: notes || undefined,
        },
        { onSuccess: () => setMode("idle"), ...errorHandler },
      );
    } else if (mode === "confirm") {
      confirm.mutate(
        {
          stage_date_id: meetingDate.id,
          datetime: iso,
          notes: notes || undefined,
        },
        { onSuccess: () => setMode("idle"), ...errorHandler },
      );
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card"
        aria-busy="true"
      >
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    );
  }

  // ─── Confirmed state ───
  if (isConfirmed && meetingDate) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--success-light))] border border-[hsl(var(--success)/0.2)]">
          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--success))]">
              {journeyCopy.dates.meeting.confirmed}
            </p>
            <p className="text-xs text-[hsl(var(--success))]">
              {format(
                parseISO(meetingDate.bwild_confirmed_at!),
                "EEEE, d 'de' MMMM 'às' HH:mm",
                { locale: ptBR },
              )}
            </p>
          </div>
          {!isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs shrink-0 min-w-[44px]"
              onClick={handleOpenPropose}
            >
              {journeyCopy.dates.meeting.changeSuggestion}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs shrink-0 min-w-[44px]"
              onClick={handleOpenConfirm}
            >
              {journeyCopy.dates.meeting.adjust}
            </Button>
          )}
        </div>

        {/* Show divergence if customer proposed a different date */}
        {meetingDate.customer_proposed_at &&
          meetingDate.customer_proposed_at !==
            meetingDate.bwild_confirmed_at && (
            <p className="text-xs text-muted-foreground px-1">
              💡 {journeyCopy.dates.divergence.customerSuggested}{" "}
              <span className="font-medium">
                {format(
                  parseISO(meetingDate.customer_proposed_at),
                  "dd/MM 'às' HH:mm",
                )}
              </span>
            </p>
          )}

        {mode !== "idle" && (
          <DateTimeForm
            mode={mode}
            pickerDate={pickerDate}
            pickerTime={pickerTime}
            notes={notes}
            isPending={isPending}
            isStaff={isAdmin}
            hasConfirmed={isConfirmed}
            onDateChange={setPickerDate}
            onTimeChange={setPickerTime}
            onNotesChange={setNotes}
            onSubmit={handleSubmit}
            onCancel={() => setMode("idle")}
          />
        )}
      </div>
    );
  }

  // ─── Proposed (waiting confirmation) ───
  if (isProposed && meetingDate) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning)/0.2)]">
          <Clock className="h-5 w-5 text-[hsl(var(--warning))] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--warning))]">
              {journeyCopy.dates.meeting.awaitingConfirmation}
            </p>
            <p className="text-xs text-[hsl(var(--warning))]">
              Sugestão:{" "}
              {format(
                parseISO(meetingDate.customer_proposed_at!),
                "EEEE, d 'de' MMMM 'às' HH:mm",
                { locale: ptBR },
              )}
            </p>
          </div>
          {!isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs shrink-0 min-w-[44px]"
              onClick={handleOpenPropose}
            >
              {journeyCopy.dates.meeting.changeSuggestion}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-11 text-xs shrink-0 gap-1.5 min-w-[44px]"
              onClick={handleOpenConfirm}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {journeyCopy.dates.meeting.confirmDate}
            </Button>
          )}
        </div>

        {!isAdmin && (
          <p className="text-xs text-muted-foreground italic px-1">
            ✨ {journeyCopy.dates.meeting.customerMicrocopy}
          </p>
        )}

        {mode !== "idle" && (
          <DateTimeForm
            mode={mode}
            pickerDate={pickerDate}
            pickerTime={pickerTime}
            notes={notes}
            isPending={isPending}
            isStaff={isAdmin}
            hasConfirmed={false}
            onDateChange={setPickerDate}
            onTimeChange={setPickerTime}
            onNotesChange={setNotes}
            onSubmit={handleSubmit}
            onCancel={() => setMode("idle")}
          />
        )}
      </div>
    );
  }

  // ─── No date yet ───
  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <Button
          className="w-full md:w-auto min-h-[44px] gap-2"
          onClick={handleOpenPropose}
        >
          <Sparkles className="h-4 w-4" />
          {ctaText || journeyCopy.dates.meeting.chooseDateCta}
        </Button>
      ) : (
        <DateTimeForm
          mode={mode}
          pickerDate={pickerDate}
          pickerTime={pickerTime}
          notes={notes}
          isPending={isPending}
          isStaff={isAdmin}
          hasConfirmed={false}
          onDateChange={setPickerDate}
          onTimeChange={setPickerTime}
          onNotesChange={setNotes}
          onSubmit={handleSubmit}
          onCancel={() => setMode("idle")}
        />
      )}
    </div>
  );
}

// ─── Shared DateTime Form ───

function DateTimeForm({
  mode,
  pickerDate,
  pickerTime,
  notes,
  isPending,
  isStaff,
  hasConfirmed,
  onDateChange,
  onTimeChange,
  onNotesChange,
  onSubmit,
  onCancel,
}: {
  mode: "propose" | "confirm";
  pickerDate: Date | undefined;
  pickerTime: string;
  notes: string;
  isPending: boolean;
  isStaff: boolean;
  hasConfirmed: boolean;
  onDateChange: (d: Date | undefined) => void;
  onTimeChange: (t: string) => void;
  onNotesChange: (n: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card shadow-[var(--shadow-sm)] space-y-3">
      <p className="text-xs font-medium text-foreground">
        {mode === "propose"
          ? journeyCopy.dates.form.proposeTitle
          : journeyCopy.dates.form.confirmTitle}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-11 min-h-[44px] text-xs flex-1 min-w-[140px] justify-start",
                !pickerDate && "text-muted-foreground",
              )}
              disabled={isPending}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              {pickerDate
                ? format(pickerDate, "dd/MM/yyyy")
                : journeyCopy.dates.form.chooseDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={pickerDate}
              onSelect={onDateChange}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="p-3 pointer-events-auto"
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        <TimePicker value={pickerTime} onChange={onTimeChange} />
      </div>

      <Input
        placeholder={journeyCopy.dates.form.notesPlaceholder}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="h-11 min-h-[44px] text-sm"
        disabled={isPending}
      />

      {mode === "propose" && !isStaff && hasConfirmed && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          ✨ {journeyCopy.dates.meeting.customerMicrocopy}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-11 min-h-[44px] gap-1.5"
          disabled={!pickerDate || isPending}
          onClick={onSubmit}
        >
          {isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {mode === "propose"
            ? journeyCopy.dates.form.submitPropose
            : journeyCopy.dates.form.submitConfirm}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-h-[44px]"
          onClick={onCancel}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5 mr-1" /> {journeyCopy.dates.form.cancel}
        </Button>
      </div>
    </div>
  );
}
