/**
 * CronogramaPdfButton: "Exportar PDF" (padrão Bewild) e "Enviar por WhatsApp".
 *
 * - Exportar: baixa o PDF (planejado ou planejado x realizado).
 * - WhatsApp (staff): gera, guarda em Documentos, cria link de 7 dias e abre
 *   o wa.me com a mensagem pronta (ou o compartilhamento nativo no celular).
 * - Revisão: se as datas mudaram depois da última exportação, oferece
 *   "Nova revisão" (R+1), que cita na capa a mudança da entrega prevista.
 */

import { useState } from "react";
import { ChevronDown, FileDown, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { trackAmplitude } from "@/lib/amplitude";
import {
  generateCronogramaPdf,
  CronogramaPdfEmptyError,
  empreendimentoOf,
  fmtDate,
  type CronogramaPdfProject,
} from "@/lib/pdf/cronogramaPdf";
import {
  firstName,
  generateAndStoreSchedulePdf,
  needsNewRevision,
} from "@/lib/pdf/cronogramaExport";
import { scheduleExportRepo } from "@/infra/repositories";
import type { ScheduleExportMeta } from "@/infra/repositories/scheduleExport.repository";
import { captureError } from "@/lib/errorMonitoring";
import { useAuth } from "@/hooks/useAuth";
import { useCanFeature } from "@/hooks/useCan";
import { CRONOGRAMA_PDF_COPY as COPY } from "@/content/cronogramaPdf";
import type { ProjectActivity } from "@/hooks/useProjectActivities";
import { SendScheduleWhatsAppDialog } from "./SendScheduleWhatsAppDialog";

interface Props {
  project: CronogramaPdfProject | null | undefined;
  activities: ProjectActivity[];
  /** Prévia da Nova Obra: só exporta (a obra ainda não existe). */
  previewOnly?: boolean;
}

type Pending = { kind: "export"; mode: "planned" | "comparison" } | { kind: "whatsapp" };

export function CronogramaPdfButton({ project, activities, previewOnly }: Props) {
  const { user } = useAuth();
  const canSend = useCanFeature("schedule:send_whatsapp");
  const canRevise = useCanFeature("schedule:new_revision");
  const [exporting, setExporting] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [meta, setMeta] = useState<ScheduleExportMeta | null>(null);
  const [revision, setRevision] = useState<{ n: number; previous: string | null }>({
    n: 0,
    previous: null,
  });
  const [askRevision, setAskRevision] = useState<Pending | null>(null);
  const empty = !project || !activities || activities.length === 0;
  const projectId = !previewOnly ? project?.id : undefined;

  const loadMeta = async (): Promise<ScheduleExportMeta | null> => {
    if (!projectId) return null;
    const r = await scheduleExportRepo.getScheduleExportMeta(projectId);
    if (r.error) return null;
    setMeta(r.data);
    return r.data;
  };

  const fullProject = (m: ScheduleExportMeta | null, rev: { n: number; previous: string | null }): CronogramaPdfProject => ({
    ...project!,
    unit_name: project?.unit_name ?? m?.unit_name ?? null,
    nome_do_empreendimento: project?.nome_do_empreendimento ?? m?.nome_do_empreendimento ?? null,
    customer_name: project?.customer_name ?? m?.customer_name ?? null,
    schedule_revision: rev.n,
    previous_delivery: rev.previous,
  });

  /** Decide a revisão; pergunta se as datas mudaram desde a última exportação. */
  const start = async (pending: Pending) => {
    if (empty) {
      toast.error(COPY.errors.empty);
      return;
    }
    const m = await loadMeta();
    const current = { n: m?.schedule_revision ?? 0, previous: null };
    setRevision(current);
    if (m && canRevise && needsNewRevision(activities, m.schedule_exported_at)) {
      setAskRevision(pending);
      return;
    }
    void run(pending, m, current);
  };

  const run = async (
    pending: Pending,
    m: ScheduleExportMeta | null,
    rev: { n: number; previous: string | null },
  ) => {
    setRevision(rev);
    if (pending.kind === "whatsapp") {
      setWaOpen(true);
      return;
    }
    setExporting(true);
    const toastId = toast.loading(COPY.ui.exporting);
    try {
      const { doc, fileName, end } = await generateCronogramaPdf(
        fullProject(m, rev),
        activities,
        { mode: pending.mode },
      );
      doc.save(fileName);
      if (projectId && canRevise) {
        await scheduleExportRepo.saveScheduleExportState(projectId, {
          revision: rev.n,
          exportedEnd: end,
        });
      }
      const blobUrl = URL.createObjectURL(doc.output("blob"));
      trackAmplitude("cronograma_pdf_exported", {
        project_id: projectId ?? null,
        activities_count: activities.length,
        mode: pending.mode,
        revision: rev.n,
      });
      toast.success(COPY.ui.exported, {
        id: toastId,
        action: { label: COPY.ui.openPdf, onClick: () => window.open(blobUrl, "_blank") },
      });
    } catch (err) {
      if (err instanceof CronogramaPdfEmptyError) {
        toast.error(err.message, { id: toastId });
      } else {
        captureError(err, { feature: "cronograma" });
        toast.error(COPY.errors.generic, { id: toastId });
      }
    } finally {
      setExporting(false);
    }
  };

  const prepareWhatsApp = async () => {
    if (!projectId || !user) throw new Error(COPY.errors.generic);
    const stored = await generateAndStoreSchedulePdf({
      project: { ...fullProject(meta, revision), id: projectId },
      activities,
      userId: user.id,
      revision: revision.n,
    });
    const p = fullProject(meta, revision);
    const message = COPY.whatsappMessage({
      firstName: firstName(p.customer_name),
      empreendimento: empreendimentoOf(p),
      unidade: p.unit_name ?? "",
      inicio: fmtDate(stored.start),
      entrega: fmtDate(stored.end),
      url: stored.url,
    });
    toast.success(COPY.ui.exported, {
      action: {
        label: COPY.ui.copyLink,
        onClick: () => {
          void navigator.clipboard?.writeText(stored.url);
          toast.success(COPY.ui.linkCopied);
        },
      },
      cancel: { label: COPY.ui.openPdf, onClick: () => window.open(stored.url, "_blank") },
    });
    trackAmplitude("cronograma_pdf_whatsapp", { project_id: projectId, revision: revision.n });
    return { file: stored.file, url: stored.url, message };
  };

  const showWhatsApp = canSend && !previewOnly;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] text-xs sm:min-h-0"
            disabled={empty || exporting}
            title={empty ? COPY.errors.empty : COPY.ui.export}
            aria-label={COPY.ui.export}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1.5 h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {exporting ? COPY.ui.exporting : COPY.ui.export}
            </span>
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => start({ kind: "export", mode: "planned" })}>
            {COPY.ui.planned}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => start({ kind: "export", mode: "comparison" })}>
            {COPY.ui.comparison}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showWhatsApp && (
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] text-xs sm:min-h-0"
          disabled={empty}
          onClick={() => start({ kind: "whatsapp" })}
          aria-label={COPY.ui.whatsapp}
          title={empty ? COPY.errors.empty : COPY.ui.whatsapp}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">{COPY.ui.whatsapp}</span>
        </Button>
      )}

      <AlertDialog open={!!askRevision} onOpenChange={(o) => !o && setAskRevision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{COPY.ui.newRevision}</AlertDialogTitle>
            <AlertDialogDescription>
              {COPY.ui.newRevisionHint((meta?.schedule_revision ?? 0) + 1)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="min-h-[44px]"
              onClick={() => {
                const p = askRevision;
                setAskRevision(null);
                if (p) void run(p, meta, { n: meta?.schedule_revision ?? 0, previous: null });
              }}
            >
              {COPY.ui.keepRevision}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              onClick={() => {
                const p = askRevision;
                setAskRevision(null);
                if (p)
                  void run(p, meta, {
                    n: (meta?.schedule_revision ?? 0) + 1,
                    previous: meta?.schedule_exported_end ?? null,
                  });
              }}
            >
              {COPY.ui.newRevision}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showWhatsApp && (
        <SendScheduleWhatsAppDialog
          open={waOpen}
          onOpenChange={setWaOpen}
          defaultPhone={meta?.customer_phone ?? null}
          onPrepare={prepareWhatsApp}
        />
      )}
    </>
  );
}
