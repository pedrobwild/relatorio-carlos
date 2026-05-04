import { Pencil, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ProjectTemplate } from "@/hooks/useProjectTemplates";
import {
  type ActivityItem,
  totalDays,
  totalWeight,
  getCategoryLabel,
} from "./types";

interface TemplatePreviewSheetProps {
  template: ProjectTemplate | null;
  onClose: () => void;
  versions: any[] | undefined;
  restoreVersion: any;
  onEdit: (t: ProjectTemplate) => void;
  onExport: (t: ProjectTemplate) => void;
  onDuplicate: (t: ProjectTemplate) => void;
  toast: any;
}

export function TemplatePreviewSheet({
  template,
  onClose,
  versions,
  restoreVersion,
  onEdit,
  onExport,
  onDuplicate,
  toast,
}: TemplatePreviewSheetProps) {
  if (!template) return null;

  return (
    <Sheet open={!!template} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {template.description && (
            <p className="text-sm text-muted-foreground">
              {template.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-medium text-sm">
                {template.is_project_phase ? "Fase de Projeto" : "Execução"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Categoria</p>
              <p className="font-medium text-sm">
                {getCategoryLabel(template.category || "geral")}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Valor Padrão</p>
              <p className="font-medium text-sm">
                {template.default_contract_value
                  ? `R$ ${Number(template.default_contract_value).toLocaleString("pt-BR")}`
                  : "—"}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">
              Atividades ({(template.default_activities ?? []).length})
            </h4>
            {(template.default_activities ?? []).length > 0 ? (
              <>
                {/* Mini-Gantt */}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Timeline
                  </p>
                  <div className="space-y-1">
                    {(() => {
                      const acts =
                        template.default_activities as ActivityItem[];
                      const cumDays: number[] = [];
                      let acc = 0;
                      acts.forEach((a) => {
                        cumDays.push(acc);
                        acc += a.durationDays;
                      });
                      const total = acc;
                      return acts.map((act, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 group/bar"
                        >
                          <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 h-4 relative rounded-sm overflow-hidden bg-muted">
                            <div
                              className="absolute top-0 h-full rounded-sm bg-primary/60 group-hover/bar:bg-primary/80 transition-colors"
                              style={{
                                left: `${(cumDays[i] / total) * 100}%`,
                                width: `${Math.max((act.durationDays / total) * 100, 2)}%`,
                              }}
                              title={`${act.description} — ${act.durationDays}d`}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      Dia 1
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Dia{" "}
                      {totalDays(template.default_activities as ActivityItem[])}
                    </span>
                  </div>
                </div>
                {/* Table */}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Atividade</TableHead>
                        <TableHead className="text-xs w-20 text-right">
                          Dias
                        </TableHead>
                        <TableHead className="text-xs w-20 text-right">
                          Peso %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(template.default_activities as ActivityItem[]).map(
                        (act, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              {act.description}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {act.durationDays}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {act.weight}%
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-sm">Total</TableCell>
                        <TableCell className="text-sm text-right">
                          {totalDays(
                            template.default_activities as ActivityItem[],
                          )}
                          d
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {totalWeight(
                            template.default_activities as ActivityItem[],
                          )}
                          %
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma atividade pré-definida
              </p>
            )}
          </div>

          {/* Version History */}
          {versions && versions.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">
                  Histórico de versões ({versions.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          v{v.version_number} — {v.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={restoreVersion.isPending}
                        onClick={async () => {
                          try {
                            await restoreVersion.mutateAsync({
                              templateId: template.id,
                              version: v,
                            });
                            toast({
                              title: `Restaurado para v${v.version_number}`,
                            });
                            onClose();
                          } catch {
                            toast({
                              title: "Erro ao restaurar",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                onClose();
                onEdit(template);
              }}
              className="flex-1 gap-2"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              onClick={() => onExport(template)}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onDuplicate(template);
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
