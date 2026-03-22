import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WeeklyReportData } from "@/types/weeklyReport";

interface AIReportGeneratorProps {
  projectId: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  currentData: WeeklyReportData;
  onGenerated: (updatedData: WeeklyReportData) => void;
}

export function AIReportGenerator({
  projectId,
  weekNumber,
  weekStart,
  weekEnd,
  currentData,
  onGenerated,
}: AIReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
        body: { projectId, weekNumber, weekStart, weekEnd },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na geração");

      const generated = data.data;

      // Merge AI data into current report data (preserving gallery, KPIs, etc.)
      const merged: WeeklyReportData = {
        ...currentData,
        executiveSummary: generated.executiveSummary || currentData.executiveSummary,
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
      toast.success("Relatório gerado com IA! Revise e edite antes de salvar.");
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error(err.message || "Erro ao gerar relatório com IA");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
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
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar relatório com IA
          </AlertDialogTitle>
          <AlertDialogDescription>
            A IA analisará as atividades, etapas, conversas e pendências do projeto
            para gerar automaticamente o resumo executivo, tarefas da próxima semana,
            riscos e decisões pendentes.
            <br /><br />
            <strong>O conteúdo atual será substituído.</strong> Você poderá revisar e
            editar antes de salvar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Gerando..." : "Gerar relatório"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
