import { WeeklyReportQualityItem, PendingItem } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, XCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QualitySectionProps {
  qualityItems: WeeklyReportQualityItem[];
}

const getSeverityColor = (severity: PendingItem["severity"]) => {
  switch (severity) {
    case "verde":
      return "bg-success";
    case "amarelo":
      return "bg-warning";
    case "vermelho":
      return "bg-destructive";
  }
};

const QualitySection = ({ qualityItems }: QualitySectionProps) => {
  // Flatten all pending items
  const allPendingItems = qualityItems.flatMap(q => q.pendingItems);
  const allNonConformities = qualityItems.flatMap(q => q.nonConformities);

  return (
    <div className="space-y-4">
      {/* Checklists Executed */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 sm:p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Qualidade, Testes e Pendências</h3>
          </div>
        </div>
        
        <div className="divide-y divide-border">
          {qualityItems.map((item, index) => (
            <Dialog key={index}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto p-4 rounded-none hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-foreground">{item.checklistName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.nonConformities.length > 0 && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                        {item.nonConformities.length} NC
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold">{item.checklistName}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  {/* Checklist Items */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Itens do Checklist</p>
                    <ul className="space-y-2">
                      {item.items.map((checkItem, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 rounded bg-secondary/50">
                          <span className="text-sm text-foreground">{checkItem.name}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              checkItem.result === "aprovado" 
                                ? "bg-success/10 text-success border-success/20" 
                                : checkItem.result === "reprovado"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {checkItem.result}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Non-Conformities */}
                  {item.nonConformities.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Não Conformidades</p>
                      <ul className="space-y-2">
                        {item.nonConformities.map((nc) => (
                          <li key={nc.id} className="p-3 rounded bg-destructive/5 border border-destructive/20">
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-foreground">{nc.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Responsável: {nc.responsible} • Correção: {format(new Date(nc.correctionDate), "dd/MM", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>

      {/* Pending Items (Semáforo) */}
      {allPendingItems.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Pendências para Entrega</h3>
          </div>
          <ul className="space-y-2">
            {allPendingItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-2 rounded bg-secondary/50">
                <span className={`w-2 h-2 rounded-full ${getSeverityColor(item.severity)}`} />
                <span className="text-sm text-foreground flex-1">{item.description}</span>
                <span className="text-xs text-muted-foreground">
                  até {format(new Date(item.dueDate), "dd/MM", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default QualitySection;
