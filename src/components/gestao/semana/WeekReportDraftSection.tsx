/**
 * "Texto para o relatório do cliente" — rascunho montado no fechamento da
 * semana (Fase 6), por etapa: o que foi feito e o que vem na próxima semana.
 *
 * Só para COPIAR. Não grava em `weekly_reports`: uma linha ali fica visível ao
 * cliente sozinha no dia seguinte ao fim da semana, às 20h. O relatório
 * continua sendo publicado pela tela de relatórios, revisado por gente.
 */
import { useMemo, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trackAmplitude } from "@/lib/amplitude";
import { buildWeekReportDraft, type ReportActivity } from "@/lib/semanaRelatorio";
import type { OpsAssignment, OpsStageOption } from "@/infra/repositories/ops.repository";

interface Props {
  projectId: string;
  monday: string;
  assignments: ReadonlyArray<Pick<OpsAssignment, "activity_id" | "work_date" | "outcome">>;
  nextAssignments: ReadonlyArray<Pick<OpsAssignment, "activity_id" | "work_date" | "outcome">>;
  activities: ReadonlyArray<ReportActivity>;
  stages: ReadonlyArray<Pick<OpsStageOption, "description" | "sort_order" | "planned_start" | "planned_end" | "actual_end">>;
}

export function WeekReportDraftSection({ projectId, monday, assignments, nextAssignments, activities, stages }: Props) {
  const [open, setOpen] = useState(false);
  const draft = useMemo(
    () => buildWeekReportDraft({ monday, assignments, nextAssignments, activities, stages }),
    [monday, assignments, nextAssignments, activities, stages],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.text);
      trackAmplitude("ops_report_draft_copied", { stages_done: draft.done.length, stages_next: draft.next.length });
      toast.success("Texto copiado", { description: "Cole no relatório semanal da obra e revise antes de publicar." });
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
    }
  };

  return (
    <section aria-labelledby="fechar-relatorio" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="fechar-relatorio" className="text-sm font-semibold text-foreground">
          Texto para o relatório do cliente
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[40px]"
          aria-expanded={open}
          aria-controls="fechar-relatorio-texto"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Esconder" : "Ver texto"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Pronto para colar no relatório semanal: por etapa, sem nomes nem custos. Nada é enviado ao cliente daqui.
      </p>
      {open && (
        <div id="fechar-relatorio-texto" className="space-y-2">
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-sans text-sm text-foreground">
            {draft.text}
          </pre>
          {draft.nextFromSchedule && (
            <p className="text-xs text-muted-foreground">
              A próxima semana ainda não foi planejada: o texto usa as etapas previstas no cronograma.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar texto
            </Button>
            <Button asChild variant="ghost" className="min-h-[44px]">
              <a href={`/obra/${projectId}?tab=relatorios`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir relatórios da obra
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
