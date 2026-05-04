import { Check, Clock, Calendar, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProjectPayment } from "@/hooks/useProjectPayments";
import { BoletoUploadButton } from "@/components/BoletoUploadButton";
import { downloadBoleto } from "@/hooks/useBoletoUpload";
import { getUrgency, getDaysLabel, formatCurrency } from "./helpers";

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
};

const formatShortDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM", { locale: ptBR });
};

interface DesktopPaymentCardProps {
  payment: ProjectPayment;
  isAdmin: boolean;
  projectId: string;
  onTogglePaid: (payment: ProjectPayment) => void;
  isPending: boolean;
}

export function DesktopPaymentCard({
  payment,
  isAdmin,
  projectId,
  onTogglePaid,
  isPending,
}: DesktopPaymentCardProps) {
  const daysLabel = getDaysLabel(payment);
  const urgency = getUrgency(payment);

  return (
    <div
      className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
        payment.paid_at
          ? "bg-card border-border"
          : urgency === "overdue" || urgency === "urgent"
            ? "bg-rose-500/5 border-rose-500/30"
            : urgency === "approaching"
              ? "bg-amber-500/5 border-amber-500/30"
              : "bg-card border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-body font-medium truncate">
              {payment.description}
            </p>
          </div>
          <div className="flex items-center gap-3 text-caption">
            {payment.paid_at ? (
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Pago em {formatShortDate(payment.paid_at)}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Vencimento:{" "}
                {payment.due_date
                  ? formatDate(payment.due_date)
                  : "Em definição"}
              </span>
            )}
            {daysLabel && (
              <span className={`font-medium ${daysLabel.color}`}>
                {daysLabel.text}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <p className="text-h3 tabular-nums">
            {formatCurrency(payment.amount)}
          </p>

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {payment.paid_at ? "Pago" : "Pendente"}
              </span>
              <Switch
                checked={!!payment.paid_at}
                onCheckedChange={() => onTogglePaid(payment)}
                disabled={isPending}
              />
            </div>
          ) : payment.paid_at ? (
            <Badge variant="secondary" className="text-tiny">
              Quitado
            </Badge>
          ) : payment.boleto_path ? (
            <Button
              variant="outline"
              size="sm"
              className="h-11 min-h-[44px] px-3 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              onClick={() => downloadBoleto(payment.boleto_path!)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Boleto
            </Button>
          ) : (
            <Badge
              variant="outline"
              className="text-tiny text-muted-foreground"
            >
              Aguardando boleto
            </Badge>
          )}

          {isAdmin && !payment.paid_at && (
            <BoletoUploadButton
              paymentId={payment.id}
              projectId={projectId}
              boletoPath={payment.boleto_path}
            />
          )}

          {isAdmin && payment.boleto_path && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground min-h-auto"
              onClick={() => downloadBoleto(payment.boleto_path!)}
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface MobilePaymentCardProps {
  payment: ProjectPayment;
  isAdmin: boolean;
  projectId: string;
  onTogglePaid: (payment: ProjectPayment) => void;
  isPending: boolean;
}

export function MobilePaymentCard({
  payment,
  isAdmin,
  projectId,
  onTogglePaid,
  isPending,
}: MobilePaymentCardProps) {
  const daysLabel = getDaysLabel(payment);

  return (
    <div className="px-4 py-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium truncate mb-1">
            {payment.description}
          </p>
          <div className="flex items-center gap-2 text-caption">
            {payment.paid_at ? (
              <>
                <Check className="w-3.5 h-3.5 text-foreground" />
                <span>Pago em {formatShortDate(payment.paid_at)}</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Vencimento:{" "}
                  {payment.due_date
                    ? formatDate(payment.due_date)
                    : "Em definição"}
                </span>
              </>
            )}
          </div>
          {daysLabel && (
            <p className={`text-caption mt-1 font-medium ${daysLabel.color}`}>
              {daysLabel.text}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-h3 tabular-nums">
            {formatCurrency(payment.amount)}
          </p>

          {isAdmin ? (
            <div className="flex items-center gap-2 mt-2 justify-end">
              <span className="text-xs text-muted-foreground">
                {payment.paid_at ? "Pago" : "Pend."}
              </span>
              <Switch
                checked={!!payment.paid_at}
                onCheckedChange={() => onTogglePaid(payment)}
                disabled={isPending}
              />
            </div>
          ) : payment.paid_at ? (
            <span className="text-caption">Quitado</span>
          ) : payment.boleto_path ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 min-h-[44px] px-3 mt-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => downloadBoleto(payment.boleto_path!)}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Boleto
            </Button>
          ) : (
            <span className="text-tiny text-muted-foreground">
              Aguardando boleto
            </span>
          )}

          {isAdmin && !payment.paid_at && (
            <div className="mt-1">
              <BoletoUploadButton
                paymentId={payment.id}
                projectId={projectId}
                boletoPath={payment.boleto_path}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
