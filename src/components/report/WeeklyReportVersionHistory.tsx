import { useState } from "react";
import { History, RotateCcw, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { EmptyState } from "@/components/ui/states";
import { useWeeklyReportVersions } from "@/hooks/useWeeklyReportVersions";
import type { WeeklyReportVersion } from "@/infra/repositories/weeklyReports.repository";
import type { WeeklyReportData } from "@/types/weeklyReport";

interface Props {
  projectId: string;
  weekNumber: number;
  /** Recebe o conteúdo restaurado para atualizar o editor aberto. */
  onRestored?: (data: WeeklyReportData) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarize(data: WeeklyReportData): string {
  const text = (data?.executiveSummary ?? "").replace(/<[^>]*>/g, "").trim();
  if (!text) return "Sem resumo executivo nesta versão.";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/**
 * Histórico de versões do relatório semanal. Cada salvamento cria uma versão
 * com o texto e as fotos daquele momento — nada é sobrescrito de forma
 * definitiva e é possível voltar a uma versão anterior.
 */
export function WeeklyReportVersionHistory({
  projectId,
  weekNumber,
  onRestored,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<WeeklyReportVersion | null>(null);
  const { versions, isLoading, restoreVersion, isRestoring } =
    useWeeklyReportVersions({ projectId, weekNumber, enabled: open });

  const handleRestore = async () => {
    if (!pending) return;
    try {
      await restoreVersion(pending.id);
      onRestored?.(pending.data);
      setPending(null);
      setOpen(false);
    } catch {
      // Feedback já exibido pelo hook.
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <History className="w-4 h-4 mr-2" />
            Histórico de versões
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Histórico da semana {weekNumber}</SheetTitle>
            <SheetDescription>
              Cada salvamento gera uma versão com o texto e as fotos daquele
              momento. Restaurar não apaga nada: a versão atual continua no
              histórico.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Carregando versões…
              </div>
            ) : versions.length === 0 ? (
              <EmptyState
                icon={History}
                title="Nenhuma versão registrada"
                description="Assim que o relatório for salvo, as versões aparecem aqui."
              />
            ) : (
              <ul className="space-y-3 pb-6">
                {versions.map((version, index) => {
                  const photos = version.data?.gallery?.length ?? 0;
                  const isCurrent = index === 0;
                  return (
                    <li
                      key={version.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              Versão {version.version}
                            </span>
                            {isCurrent && (
                              <Badge variant="secondary">Versão atual</Badge>
                            )}
                            {version.restored_from_version !== null && (
                              <Badge variant="outline">
                                Restaurada da v
                                {version.restored_from_version}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(version.created_at)}
                          </p>
                        </div>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 min-h-11"
                            onClick={() => setPending(version)}
                            disabled={isRestoring}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restaurar
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {summarize(version.data)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {photos} {photos === 1 ? "foto/vídeo" : "fotos/vídeos"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restaurar a versão {pending?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O relatório volta ao texto e às fotos dessa versão. A versão atual
              permanece no histórico e pode ser restaurada depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restaurando…" : "Restaurar versão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </>
  );
}

export default WeeklyReportVersionHistory;
