import { useState } from "react";
import { ChevronUp, ChevronDown, Check, Circle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FormData } from "./types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface MobileSummarySheetProps {
  formData: FormData;
  currentStep: number;
  completedSteps: Set<number>;
  totalSteps: number;
}

const stepLabels = ["Cadastro", "Comercial", "Planejamento", "Revisão"];

export function MobileSummarySheet({
  formData,
  currentStep,
  completedSteps,
  totalSteps,
}: MobileSummarySheetProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const completedCount = completedSteps.size;
  const currentLabel = stepLabels[currentStep] ?? "";

  const handleSaveDraft = () => {
    toast.success("Rascunho salvo! Você pode continuar depois.");
    navigate("/gestao");
  };

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40">
      {expanded && (
        <div
          className="fixed inset-0 bg-black/20 z-[-1]"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={cn(
          "bg-card border-t border-border shadow-lg transition-all duration-300 rounded-t-xl",
          expanded ? "max-h-[60dvh]" : "max-h-16",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    completedSteps.has(i)
                      ? "bg-primary"
                      : i === currentStep
                        ? "bg-primary/50 animate-pulse"
                        : "bg-muted-foreground/20",
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {completedCount}/{totalSteps} ·{" "}
              <span className="text-foreground">{currentLabel}</span>
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[calc(60dvh-56px)]">
            {stepLabels.map((label, i) => {
              const isCompleted = completedSteps.has(i);
              const isCurrent = currentStep === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm",
                    isCurrent && "bg-primary/5 border border-primary/20",
                    isCompleted && !isCurrent && "bg-muted/30",
                    !isCurrent && !isCompleted && "opacity-50",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : isCurrent ? (
                    <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0 animate-pulse" />
                  ) : (
                    <Circle className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "font-medium",
                      isCurrent ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  {isCompleted && i === 0 && formData.name && (
                    <span className="text-xs text-muted-foreground truncate ml-auto">
                      {formData.name}
                    </span>
                  )}
                  {isCompleted &&
                    i === 1 &&
                    (formData.contract_value || formData.budget_uploaded) && (
                      <span className="text-xs text-muted-foreground truncate ml-auto">
                        {formData.contract_value
                          ? `R$ ${parseFloat(formData.contract_value).toLocaleString("pt-BR")}`
                          : ""}
                        {formData.budget_uploaded ? " · Orçamento ✓" : ""}
                      </span>
                    )}
                </div>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleSaveDraft}
            >
              <Save className="h-3.5 w-3.5" />
              Continuar depois
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
