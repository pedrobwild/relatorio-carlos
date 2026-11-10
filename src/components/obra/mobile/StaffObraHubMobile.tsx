/**
 * Hub da obra para a equipe no celular (redesenho mobile, passo 1).
 *
 * Abre em /obra/:projectId no lugar do cockpit completo: resumo de progresso
 * e as três ações do dia a dia (atualizar etapas, relatório da semana, foto),
 * depois os atalhos para o restante. Gestor e observações internas descem
 * para depois das ações. O cliente e o desktop continuam na `Index`.
 */
import { useId, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, Camera, ChevronLeft, ChevronRight, FileText, type LucideIcon } from "lucide-react";
import { GestorObraSelect } from "@/components/obra/GestorObraSelect";
import { InternalNotesCard } from "@/components/internal-notes/InternalNotesCard";
import { useProjectMetrics } from "@/components/header/useReportHeaderData";
import { useProject } from "@/contexts/ProjectContext";
import { useCan } from "@/hooks/useCan";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useInternalSchedule } from "@/hooks/useInternalSchedule";
import { useProjectDeadline } from "@/hooks/useContractDeadline";
import { useReportPhotoInbox } from "@/hooks/useReportPhotoInbox";
import { useRelatorioSemanaStatus } from "@/hooks/useRelatorioSemanaStatus";
import { agruparEtapas } from "@/lib/datasReais";
import { todayISO } from "@/lib/hojeDia";
import { ddmm } from "@/lib/obrasPainel";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/report";

const L = equipeMobileLabels.hub;

const actionClass = cn(
  "flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border border-border bg-card px-4 text-left",
  "transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

function ActionBody({
  icon: Icon,
  title,
  hint,
  attention,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  attention?: boolean;
}) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className={cn("text-sm", attention ? "font-medium text-warning" : "text-muted-foreground")}>{hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

export function StaffObraHubMobile() {
  const navigate = useNavigate();
  const photoInputId = useId();
  const { project, setProject } = useProject();
  const { can } = useCan();
  const projectId = project?.id;
  const hoje = todayISO();

  const { activities: dbActivities } = useProjectActivities(projectId);
  const { items } = useInternalSchedule(projectId);
  const { data: deadline } = useProjectDeadline(projectId);

  // Mesma conta do cabeçalho da obra (peso das atividades concluídas).
  const activities = useMemo<Activity[]>(
    () =>
      dbActivities.map((a) => ({
        id: a.id,
        description: a.description,
        plannedStart: a.planned_start,
        plannedEnd: a.planned_end,
        actualStart: a.actual_start || "",
        actualEnd: a.actual_end || "",
        weight: a.weight,
      })),
    [dbActivities],
  );
  const entrega = deadline?.current_deadline ?? project?.planned_end_date ?? null;
  const metrics = useProjectMetrics(project?.planned_start_date ?? null, entrega, hoje, activities);
  const grupos = useMemo(() => agruparEtapas(items, hoje), [items, hoje]);
  const etapaAtual = grupos.paraHoje.find((e) => e.item.actual_start)?.item.description ?? null;
  const { waiting, keep } = useReportPhotoInbox(projectId);
  const relatorio = useRelatorioSemanaStatus(projectId, { inicio: project?.planned_start_date, fim: entrega });

  if (!project || !projectId) return null;

  const base = `/obra/${projectId}`;
  const canSchedule = can("schedule:edit");
  const canReport = can("reports:edit_weekly");
  const pct = Math.max(0, Math.min(100, metrics.actualProgress));
  const temCronograma = activities.length > 0;

  const onPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    // A foto fica guardada no aparelho; o relatório a recebe ao abrir.
    if (await keep(projectId, files)) navigate(`${base}/relatorio-semana`);
  };

  const atalhos: { label: string; to: string; show: boolean }[] = [
    { label: L.cronograma, to: `${base}/cronograma`, show: true },
    { label: L.cronogramaInterno, to: `${base}/cronograma-interno`, show: true },
    { label: L.compras, to: `${base}/compras`, show: true },
    { label: L.ficha, to: `${base}/dados-cliente`, show: true },
    { label: L.documentos, to: `${base}/documentos`, show: true },
    { label: L.vistorias, to: `${base}/vistorias`, show: true },
    { label: L.relatorios, to: `${base}/relatorio?tab=relatorios`, show: true },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-6 pt-2 sm:px-5">
      <Link
        to="/gestao/painel-obras"
        className="-ml-2 flex min-h-[44px] items-center gap-1 self-start rounded-lg pr-3 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        {L.voltar}
        {project.bairro ? <span className="text-foreground"> · {project.bairro}</span> : null}
      </Link>

      <section aria-label={equipeMobileLabels.obras.progresso(pct)} className="-mt-3 flex flex-col gap-2.5 rounded-2xl bg-primary-dark p-4 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[28px] font-bold leading-none tabular-nums">{temCronograma ? `${pct}%` : "–"}</span>
          {temCronograma && <span className="text-sm text-white/85">{L.previstoHoje(metrics.plannedProgress)}</span>}
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 overflow-hidden rounded-full bg-white/25"
        >
          <div className="h-2 rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between gap-3 text-sm text-white/85">
          <span className="min-w-0 truncate">{etapaAtual ? L.etapaAtual(etapaAtual) : L.semEtapaAtual}</span>
          {entrega && <span className="shrink-0">{L.entrega(ddmm(entrega))}</span>}
        </div>
      </section>

      <section aria-labelledby="hub-para-fazer" className="flex flex-col gap-2.5">
        <h2 id="hub-para-fazer" className="text-sm font-semibold text-muted-foreground">
          {L.paraFazer}
        </h2>
        {canSchedule && (
          <Link to={`${base}/etapas`} className={actionClass}>
            <ActionBody
              icon={CalendarCheck}
              title={L.atualizarEtapas}
              hint={grupos.esperando > 0 ? L.esperando(grupos.esperando) : L.etapasEmDia}
              attention={grupos.esperando > 0}
            />
          </Link>
        )}
        {canReport && (
          <>
            <Link to={`${base}/relatorio-semana`} className={actionClass}>
              <ActionBody icon={FileText} title={L.relatorio} hint={relatorio.text} />
            </Link>
            <input
              id={photoInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPhoto}
            />
            <label htmlFor={photoInputId} className={cn(actionClass, "cursor-pointer focus-within:ring-2 focus-within:ring-ring")}>
              <ActionBody
                icon={Camera}
                title={L.foto}
                hint={waiting > 0 ? equipeMobileLabels.fotosGuardadas.esperando(waiting) : L.fotoHint}
                attention={waiting > 0}
              />
            </label>
          </>
        )}
      </section>

      <section aria-labelledby="hub-mais" className="flex flex-col gap-2.5">
        <h2 id="hub-mais" className="text-sm font-semibold text-muted-foreground">
          {L.mais}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {atalhos
            .filter((a) => a.show)
            .map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex min-h-[48px] items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {a.label}
              </Link>
            ))}
        </div>
      </section>

      <section aria-labelledby="hub-equipe" className="flex flex-col gap-2.5">
        <h2 id="hub-equipe" className="text-sm font-semibold text-muted-foreground">
          {L.equipe}
        </h2>
        <GestorObraSelect
          projectId={projectId}
          gestorId={project.painel_responsavel_id ?? null}
          onSaved={(gestorId) => setProject({ ...project, painel_responsavel_id: gestorId })}
        />
        <InternalNotesCard projectId={projectId} />
      </section>
    </div>
  );
}
