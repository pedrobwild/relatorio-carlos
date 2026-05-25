/**
 * CronogramaPdfButton — botão que gera e baixa o PDF do Cronograma de Obra.
 *
 * Geração é direta (sem modal). Mostra toast de loading enquanto roda e
 * desativa o botão quando não há atividades para exportar.
 */

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trackAmplitude } from "@/lib/amplitude";
import {
  generateCronogramaPdf,
  CronogramaPdfEmptyError,
  type CronogramaPdfProject,
} from "@/lib/pdf/cronogramaPdf";
import { isProjectNotStarted } from "@/lib/scheduleState";
import { captureError } from "@/lib/errorMonitoring";
import type { ProjectActivity } from "@/hooks/useProjectActivities";

interface Props {
  project: CronogramaPdfProject | null | undefined;
  activities: ProjectActivity[];
}

export function CronogramaPdfButton({ project, activities }: Props) {
  const [exporting, setExporting] = useState(false);
  const disabled = !project || !activities || activities.length === 0;

  const handleExport = async () => {
    if (disabled || !project) return;
    setExporting(true);
    const toastId = toast.loading("Gerando PDF...");
    try {
      const { doc, fileName } = await generateCronogramaPdf(project, activities);
      doc.save(fileName);
      trackAmplitude("cronograma_pdf_exported", {
        project_id: project.id ?? null,
        activities_count: activities.length,
        project_started: !isProjectNotStarted(activities),
      });
      toast.success("Cronograma exportado", { id: toastId });
    } catch (err) {
      if (err instanceof CronogramaPdfEmptyError) {
        toast.error(err.message, { id: toastId });
      } else {
        captureError(err, { feature: "cronograma" });
        toast.error("Erro ao gerar PDF", { id: toastId });
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs"
      onClick={handleExport}
      disabled={disabled || exporting}
      title={
        disabled
          ? "Adicione atividades para exportar o cronograma"
          : "Exportar cronograma em PDF"
      }
      aria-label="Exportar cronograma em PDF"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4 mr-1.5" />
      )}
      <span className="hidden sm:inline">
        {exporting ? "Gerando..." : "Exportar PDF"}
      </span>
    </Button>
  );
}
