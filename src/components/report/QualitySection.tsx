import { WeeklyReportQualityItem, PendingItem } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, XCircle, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const ChecklistItem = ({
  item,
  index,
  animationDelay = 0,
}: {
  item: WeeklyReportQualityItem;
  index: number;
  animationDelay?: number;
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        variant="ghost"
        className="w-full justify-between h-auto p-2.5 sm:p-3 rounded-none hover:bg-secondary/50"
        style={{
          animationDelay: `${animationDelay}ms`,
          animation:
            animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
          opacity: animationDelay > 0 ? 0 : 1,
        }}
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-3 h-3 text-success" />
          <span className="text-caption font-medium text-foreground">
            {item.checklistName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {item.nonConformities.length > 0 && (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-foreground border-destructive/20 text-tiny"
            >
              {item.nonConformities.length} NC
            </Badge>
          )}
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-h3">{item.checklistName}</DialogTitle>
      </DialogHeader>
      <div className="mt-2 space-y-3">
        <div>
          <p className="text-tiny text-muted-foreground uppercase tracking-wide mb-1.5">
            Itens do Checklist
          </p>
          <ul className="space-y-1">
            {item.items.map((checkItem, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between p-1.5 rounded bg-secondary/50"
              >
                <span className="text-caption text-foreground">
                  {checkItem.name}
                </span>
                <Badge
                  variant="outline"
                  className={`text-tiny ${
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

        {item.nonConformities.length > 0 && (
          <div>
            <p className="text-tiny text-muted-foreground uppercase tracking-wide mb-1.5">
              Não Conformidades
            </p>
            <ul className="space-y-1.5">
              {item.nonConformities.map((nc) => (
                <li
                  key={nc.id}
                  className="p-2 rounded bg-destructive/5 border border-destructive/20"
                >
                  <div className="flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-caption text-foreground">
                        {nc.description}
                      </p>
                      <p className="text-tiny text-muted-foreground mt-0.5">
                        Responsável: {nc.responsible} • Correção:{" "}
                        {format(new Date(nc.correctionDate), "dd/MM", {
                          locale: ptBR,
                        })}
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
);

const QualitySection = ({ qualityItems }: QualitySectionProps) => {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isPendingOpen, setIsPendingOpen] = useState(false);

  const allPendingItems = qualityItems.flatMap((q) => q.pendingItems);

  const firstChecklist = qualityItems[0];
  const remainingChecklists = qualityItems.slice(1);
  const firstPendingItems = allPendingItems.slice(0, 2);
  const remainingPendingItems = allPendingItems.slice(2);

  return (
    <div className="space-y-2">
      {/* Checklists Executed */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
          <h3 className="text-h2 text-white">Qualidade, Testes e Pendências</h3>
        </div>

        <div className="hidden sm:block divide-y divide-border">
          {qualityItems.map((item, index) => (
            <ChecklistItem key={index} item={item} index={index} />
          ))}
        </div>

        <div className="sm:hidden">
          <Collapsible open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
            <div className="divide-y divide-border">
              {firstChecklist && (
                <ChecklistItem item={firstChecklist} index={0} />
              )}

              <CollapsibleContent className="divide-y divide-border overflow-hidden">
                {remainingChecklists.map((item, index) => (
                  <ChecklistItem
                    key={index + 1}
                    item={item}
                    index={index + 1}
                    animationDelay={isChecklistOpen ? (index + 1) * 50 : 0}
                  />
                ))}
              </CollapsibleContent>
            </div>

            {remainingChecklists.length > 0 && (
              <CollapsibleTrigger asChild>
                <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isChecklistOpen ? "Ver menos" : "Ver mais"}</span>
                  {!isChecklistOpen && (
                    <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                      +{remainingChecklists.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isChecklistOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        </div>
      </div>

      {/* Pending Items */}
      {allPendingItems.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
            <h3 className="text-h2 text-white">Pendências para Entrega</h3>
          </div>

          <div className="hidden sm:block p-2.5 sm:p-3">
            <ul className="space-y-1">
              {allPendingItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 p-1.5 rounded bg-secondary/50"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${getSeverityColor(item.severity)}`}
                  />
                  <span className="text-caption text-foreground flex-1">
                    {item.description}
                  </span>
                  <span className="text-tiny text-muted-foreground">
                    até{" "}
                    {format(new Date(item.dueDate), "dd/MM", { locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sm:hidden">
            <Collapsible open={isPendingOpen} onOpenChange={setIsPendingOpen}>
              <div className="p-2.5">
                <ul className="space-y-1">
                  {firstPendingItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 p-1.5 rounded bg-secondary/50"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${getSeverityColor(item.severity)}`}
                      />
                      <span className="text-caption text-foreground flex-1">
                        {item.description}
                      </span>
                      <span className="text-tiny text-muted-foreground">
                        até{" "}
                        {format(new Date(item.dueDate), "dd/MM", {
                          locale: ptBR,
                        })}
                      </span>
                    </li>
                  ))}

                  <CollapsibleContent className="space-y-1 overflow-hidden">
                    {remainingPendingItems.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 p-1.5 rounded bg-secondary/50"
                        style={{
                          animationDelay: `${(index + 1) * 50}ms`,
                          animation: isPendingOpen
                            ? "fade-in 0.3s ease-out forwards"
                            : undefined,
                          opacity: isPendingOpen ? 0 : 1,
                        }}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${getSeverityColor(item.severity)}`}
                        />
                        <span className="text-caption text-foreground flex-1">
                          {item.description}
                        </span>
                        <span className="text-tiny text-muted-foreground">
                          até{" "}
                          {format(new Date(item.dueDate), "dd/MM", {
                            locale: ptBR,
                          })}
                        </span>
                      </li>
                    ))}
                  </CollapsibleContent>
                </ul>
              </div>

              {remainingPendingItems.length > 0 && (
                <CollapsibleTrigger asChild>
                  <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                    <span>{isPendingOpen ? "Ver menos" : "Ver mais"}</span>
                    {!isPendingOpen && (
                      <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                        +{remainingPendingItems.length}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isPendingOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
              )}
            </Collapsible>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualitySection;
