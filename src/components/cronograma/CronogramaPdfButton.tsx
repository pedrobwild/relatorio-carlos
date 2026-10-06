/**
 * CronogramaPdfButton — botão que gera e baixa o PDF do Cronograma de Obra.
 *
 * Geração é direta (sem modal). Mostra toast de loading enquanto roda e
 * desativa o botão quando não há atividades para exportar.
 */

import { useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const handleExport = async (mode: "planned" | "comparison") => {
    if (disabled || !project) return;
    setExporting(true);
    const toastId = toast.loading("Gerando PDF...");
    try {
      const { doc, fileName } = await generateCronogramaPdf(project, activities, {
        mode,
      });
      doc.save(fileName);
      trackAmplitude("cronograma_pdf_exported", {
        project_id: project.id ?? null,
        activities_count: activities.length,
        mode,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs min-h-[44px] sm:min-h-0"
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
          <ChevronDown className="w-3.5 h-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handleExport("planned")}>
          Apenas planejado
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("comparison")}>
          Planejado x realizado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
