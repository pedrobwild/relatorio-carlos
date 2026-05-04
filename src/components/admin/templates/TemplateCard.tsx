import { useState } from "react";
import {
  Pencil,
  Trash2,
  Copy,
  Eye,
  Download,
  Tag,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useTemplateVersions,
  type ProjectTemplate,
} from "@/hooks/useProjectTemplates";
import { type ActivityItem, totalDays, getCategoryLabel } from "./types";
import { useLongPress } from "@/hooks/useLongPress";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TemplateCardProps {
  template: ProjectTemplate;
  onPreview: (t: ProjectTemplate) => void;
  onEdit: (t: ProjectTemplate) => void;
  onDuplicate: (t: ProjectTemplate) => void;
  onExport: (t: ProjectTemplate) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({
  template: t,
  onPreview,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: TemplateCardProps) {
  const acts = (t.default_activities ?? []) as ActivityItem[];
  const isMobile = useIsMobile();
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: versions } = useTemplateVersions(t.id);
  const latestVersion = versions?.[0];
  const versionCount = versions?.length ?? 0;

  const longPressHandlers = useLongPress({
    onLongPress: () => setActionSheetOpen(true),
  });

  const mobileAction = (fn: () => void) => {
    setActionSheetOpen(false);
    fn();
  };

  return (
    <>
      <Card
        className="group hover:border-primary/50 transition-colors"
        {...(isMobile ? longPressHandlers : {})}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="font-semibold truncate">{t.name}</h3>
              {t.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {t.is_project_phase ? "Fase Projeto" : "Execução"}
            </Badge>
            {t.category && t.category !== "geral" && (
              <Badge variant="outline" className="gap-1">
                <Tag className="h-3 w-3" />
                {getCategoryLabel(t.category)}
              </Badge>
            )}
            {versionCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="gap-1 text-primary border-primary/30"
                    >
                      <History className="h-3 w-3" />v
                      {latestVersion?.version_number ?? 1}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {versionCount} versão(ões) · Última:{" "}
                      {latestVersion
                        ? formatDistanceToNow(
                            new Date(latestVersion.created_at),
                            { locale: ptBR, addSuffix: true },
                          )
                        : "—"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {acts.length > 0 && (
              <Badge variant="outline">
                {acts.length} atividades · {totalDays(acts)}d
              </Badge>
            )}
            {(t.usage_count ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                {t.usage_count}× usado
              </Badge>
            )}
            {t.default_contract_value && (
              <Badge variant="outline">
                R$ {Number(t.default_contract_value).toLocaleString("pt-BR")}
              </Badge>
            )}
          </div>

          {/* Desktop: hover actions */}
          <div className="hidden md:flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onPreview(t)}
              className="h-8 gap-1"
            >
              <Eye className="h-3.5 w-3.5" /> Ver
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(t)}
              className="h-8 gap-1"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDuplicate(t)}
              className="h-8 gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport(t)}
              className="h-8 gap-1"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita. O template "{t.name}" será
                    removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(t.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Mobile: tap hint */}
          {isMobile && (
            <p className="text-[10px] text-muted-foreground/50 text-center md:hidden">
              Toque e segure para ações
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mobile action sheet */}
      <Sheet open={actionSheetOpen} onOpenChange={setActionSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base truncate">{t.name}</SheetTitle>
          </SheetHeader>
          <nav className="space-y-1">
            {[
              {
                label: "Visualizar",
                icon: Eye,
                action: () => mobileAction(() => onPreview(t)),
              },
              {
                label: "Editar",
                icon: Pencil,
                action: () => mobileAction(() => onEdit(t)),
              },
              {
                label: "Duplicar",
                icon: Copy,
                action: () => mobileAction(() => onDuplicate(t)),
              },
              {
                label: "Exportar",
                icon: Download,
                action: () => mobileAction(() => onExport(t)),
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors min-h-[48px] text-foreground hover:bg-muted/60"
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setActionSheetOpen(false);
                setDeleteDialogOpen(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors min-h-[48px] text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Excluir</span>
            </button>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Mobile delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O template "{t.name}" será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(t.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
