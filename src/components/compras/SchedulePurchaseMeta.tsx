import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InformLeadTimeDialog } from "./InformLeadTimeDialog";
import { AlertTriangle, CalendarClock, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtBR } from "@/lib/schedule/weeklySchedule";
import { purchaseDeadlineState } from "@/lib/schedule/weeklyPurchases";

export interface SchedulePurchaseFields {
  id?: string;
  item_name?: string;
  status: string;
  planned_purchase_date: string | null;
  purchase_deadline_date?: string | null;
  auto_generated?: boolean | null;
  lead_time_confirmed?: boolean | null;
  reminder_date?: string | null;
  schedule_alert?: string | null;
  schedule_conflict?: boolean | null;
}

const fmt = (iso: string | null | undefined) => (iso ? fmtBR(iso) : "Sem data");

/** Selos: "Gerada pelo cronograma", "Prazo a confirmar", alerta e conflito. */
export function SchedulePurchaseBadges({ purchase }: { purchase: SchedulePurchaseFields }) {
  const awaitingLead = purchase.auto_generated && purchase.lead_time_confirmed === false;
  const [leadOpen, setLeadOpen] = useState(false);
  if (!purchase.auto_generated && !purchase.schedule_conflict) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-0.5">
      {purchase.auto_generated && (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden />
          Gerada pelo cronograma
        </Badge>
      )}
      {awaitingLead && (
        <Badge variant="outline" className="text-[10px] gap-1 border-warning text-warning">
          <Hourglass className="h-3 w-3" aria-hidden />
          Prazo a confirmar
        </Badge>
      )}
      {awaitingLead && purchase.id && (
        <>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto min-h-6 p-0 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              setLeadOpen(true);
            }}
          >
            Informar prazo
          </Button>
          <InformLeadTimeDialog
            purchaseId={purchase.id}
            itemName={purchase.item_name ?? "Compra"}
            open={leadOpen}
            onOpenChange={setLeadOpen}
          />
        </>
      )}
      {purchase.schedule_conflict && (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Conflito com o cronograma
        </Badge>
      )}
      {purchase.schedule_alert && (
        <span className="text-[10px] text-warning" title={purchase.schedule_alert}>
          {purchase.schedule_alert}
        </span>
      )}
      {purchase.reminder_date && (
        <span className="text-[10px] text-muted-foreground">
          Agendar instalação até {fmtBR(purchase.reminder_date)}
        </span>
      )}
    </div>
  );
}

/** Datas "Ideal" e "Comprar até", amarelo depois do ideal, vermelho depois do limite. */
export function PurchaseDeadlineDates({
  purchase,
  className,
}: {
  purchase: SchedulePurchaseFields;
  className?: string;
}) {
  const state = purchaseDeadlineState(purchase);
  return (
    <div className={cn("text-xs space-y-0.5", className)}>
      <p
        className={cn(
          "tabular-nums",
          state === "late_ideal" ? "text-warning font-medium" : "text-muted-foreground",
        )}
      >
        Ideal: {fmt(purchase.planned_purchase_date)}
      </p>
      <p
        className={cn(
          "tabular-nums",
          state === "late_deadline" ? "text-destructive font-medium" : "text-muted-foreground",
        )}
      >
        Comprar até: {fmt(purchase.purchase_deadline_date)}
      </p>
      {state !== "ok" && (
        <p className={cn("font-medium", state === "late_deadline" ? "text-destructive" : "text-warning")}>
          {state === "late_deadline" ? "Passou do limite" : "Passou da data ideal"}
        </p>
      )}
    </div>
  );
}
