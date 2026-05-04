import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WeeklyReportData } from "@/types/weeklyReport";
import { cn } from "@/lib/utils";

interface AIReportGeneratorProps {
  projectId: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  currentData: WeeklyReportData;
  onGenerated: (updatedData: WeeklyReportData) => void;
}

const GENERATION_STEPS = [
  { label: "Analisando atividades...", duration: 2500 },
  { label: "Processando conversas...", duration: 2000 },
  { label: "Avaliando riscos e pendências...", duration: 2000 },
  { label: "Compilando relatório...", duration: 3000 },
];

export function AIReportGenerator({
  projectId,
  weekNumber,
  weekStart,
  weekEnd,
  currentData,
  onGenerated,
}: AIReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const cancelledRef = useRef(false);

  // Progress step animation
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      return;
    }
    let stepIdx = 0;
    const advance = () => {
      stepIdx++;
      if (stepIdx < GENERATION_STEPS.length) {
        setCurrentStep(stepIdx);
        timer = setTimeout(advance, GENERATION_STEPS[stepIdx].duration);
      }
    };
    let timer = setTimeout(advance, GENERATION_STEPS[0].duration);
    return () => clearTimeout(timer);
  }, [isGenerating]);

  const handleGenerate = async () => {
    cancelledRef.current = false;
    setIsGenerating(true);
    setCurrentStep(0);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-weekly-report",
        {
          body: { projectId, weekNumber, weekStart, weekEnd },
        },
      );

      if (cancelledRef.current) return;
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na geração");

      const generated = data.data;

      const merged: WeeklyReportData = {
        ...currentData,
        executiveSummary:
          generated.executiveSummary || currentData.executiveSummary,
        lookaheadTasks: generated.lookaheadTasks?.length
          ? generated.lookaheadTasks
          : currentData.lookaheadTasks,
        risksAndIssues: generated.risksAndIssues?.length
          ? generated.risksAndIssues
          : currentData.risksAndIssues,
        clientDecisions: generated.clientDecisions?.length
          ? generated.clientDecisions
          : currentData.clientDecisions,
      };

      onGenerated(merged);
      setDialogOpen(false);
      toast.success("Relatório gerado com IA! Revise e edite antes de salvar.");
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message =
        err instanceof Error ? err.message : "Erro ao gerar relatório com IA";
      console.error("AI generation error:", err);
      toast.error(message);
    } finally {
      if (!cancelledRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isGenerating) {
      // User closed during generation — mark cancelled
      cancelledRef.current = true;
      setIsGenerating(false);
    }
    setDialogOpen(open);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 text-xs border-primary/30 text-primary hover:bg-primary/5"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? "Gerando..." : "Gerar com IA"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar relatório com IA
          </DialogTitle>
          {isGenerating ? (
            <div className="space-y-4 py-4">
              {GENERATION_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all duration-300",
                      idx < currentStep
                        ? "bg-[hsl(var(--success))] text-white"
                        : idx === currentStep
                          ? "bg-primary text-white animate-pulse"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {idx < currentStep ? "✓" : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-sm transition-colors duration-300",
                      idx === currentStep
                        ? "text-foreground font-medium"
                        : idx < currentStep
                          ? "text-muted-foreground line-through"
                          : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${((currentStep + 1) / GENERATION_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <DialogDescription>
              A IA analisará as atividades, etapas, conversas e pendências do
              projeto para gerar automaticamente o resumo executivo, tarefas da
              próxima semana, riscos e decisões pendentes.
              <br />
              <br />
              <strong>O conteúdo atual será substituído.</strong> Você poderá
              revisar e editar antes de salvar.
            </DialogDescription>
          )}
        </DialogHeader>
        {!isGenerating && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate}>Gerar relatório</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
