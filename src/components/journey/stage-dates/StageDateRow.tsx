import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, CheckCircle2, Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { journeyCopy } from "@/constants/journeyCopy";
import { toast } from "sonner";
import {
  useConfirmStageDate,
  useStageDateEvents,
  type StageDate,
} from "@/hooks/useStageDates";
import { getDateStatus, statusConfig, typeLabels, buildISO } from "./helpers";
import { DateTimePicker } from "./DateTimePicker";
import { DateHistoryDrawer } from "./DateHistoryDrawer";

interface StageDateRowProps {
  sd: StageDate;
  isStaff: boolean;
  projectId: string;
}

export function StageDateRow({ sd, isStaff, projectId }: StageDateRowProps) {
  const [mode, setMode] = useState<"idle" | "confirm">("idle");
  const [pickerDate, setPickerDate] = useState<Date | undefined>();
  const [pickerTime, setPickerTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const confirm = useConfirmStageDate(projectId);
  const { data: events, isLoading: eventsLoading } = useStageDateEvents(
    showHistory ? sd.id : null,
  );

  const hasDate = !!sd.bwild_confirmed_at;
  const tl = typeLabels[sd.date_type] || { emoji: "📌", label: sd.date_type };

  const handleSubmit = () => {
    if (!pickerDate) return;
    const iso = buildISO(pickerDate, pickerTime);
    confirm.mutate(
      { stage_date_id: sd.id, datetime: iso, notes: notes || undefined },
      {
        onSuccess: () => setMode("idle"),
        onError: () => {
          toast.error(journeyCopy.errors.confirm_date, {
            action: { label: journeyCopy.errors.retry, onClick: handleSubmit },
          });
        },
      },
    );
  };

  const isPending = confirm.isPending;

  return (
    <article
      className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-sm)] overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]"
      aria-label={`${tl.label}: ${sd.title}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-base" aria-hidden>
          {tl.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {sd.title}
          </p>
          <p className="text-[11px] text-muted-foreground">{tl.label}</p>
        </div>
        {(() => {
          const status = getDateStatus(sd);
          const cfg = statusConfig[status];
          const StatusIcon = cfg.icon;
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] gap-1 border", cfg.badgeClass)}
            >
              <StatusIcon className="h-3 w-3" aria-hidden />
              {cfg.label}
            </Badge>
          );
        })()}
      </div>

      {/* Date display */}
      {sd.bwild_confirmed_at && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-lg bg-[hsl(var(--success-light))]">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-[hsl(var(--success))]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {journeyCopy.dates.row.confirmedLabel}
              </p>
              <p className="text-sm font-semibold text-[hsl(var(--success))]">
                {format(
                  parseISO(sd.bwild_confirmed_at),
                  "dd 'de' MMM, yyyy · HH:mm",
                  { locale: ptBR },
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      {!sd.bwild_confirmed_at && sd.customer_proposed_at && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-lg bg-[hsl(var(--warning-light))]">
            <Clock
              className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {journeyCopy.dates.row.proposedLabel}
              </p>
              <p className="text-sm font-semibold text-[hsl(var(--warning))]">
                {format(
                  parseISO(sd.customer_proposed_at),
                  "dd 'de' MMM, yyyy · HH:mm",
                  { locale: ptBR },
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {sd.notes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-md px-3 py-2">
            💬 {sd.notes}
          </p>
        </div>
      )}

      {/* Actions bar */}
      {mode === "idle" && (
        <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
          {isStaff && (
            <Button
              size="sm"
              className="h-11 text-xs gap-1.5 min-w-[44px]"
              onClick={() => {
                const ref = sd.bwild_confirmed_at;
                setPickerDate(ref ? parseISO(ref) : undefined);
                setPickerTime(ref ? format(parseISO(ref), "HH:mm") : "09:00");
                setNotes("");
                setMode("confirm");
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {hasDate ? "Alterar prazo" : "Definir prazo"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-11 text-xs gap-1 ml-auto text-muted-foreground hover:text-foreground min-w-[44px]"
            onClick={() => setShowHistory(true)}
            aria-label={`Ver histórico de ${sd.title}`}
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            {journeyCopy.dates.history.trigger}
          </Button>
        </div>
      )}

      <DateHistoryDrawer
        open={showHistory}
        onOpenChange={setShowHistory}
        title={sd.title}
        events={events}
        isLoading={eventsLoading}
      />

      {/* Confirm form — staff only */}
      {mode !== "idle" && isStaff && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <p className="text-xs font-medium text-foreground">
            📅 Definir prazo de entrega
          </p>
          <DateTimePicker
            date={pickerDate}
            time={pickerTime}
            onDateChange={setPickerDate}
            onTimeChange={setPickerTime}
            label={journeyCopy.dates.form.chooseDate}
            disabled={isPending}
            disablePastDates={false}
          />
          <Input
            placeholder={journeyCopy.dates.form.notesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 text-sm"
            disabled={isPending}
            aria-label="Observação"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-11 gap-1.5 min-w-[44px]"
              disabled={!pickerDate || isPending}
              onClick={handleSubmit}
            >
              {isPending ? (
                <span
                  className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-label={journeyCopy.a11y.saving}
                />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              {journeyCopy.dates.form.submitConfirm}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 min-w-[44px]"
              onClick={() => setMode("idle")}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" aria-hidden />{" "}
              {journeyCopy.dates.form.cancel}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
