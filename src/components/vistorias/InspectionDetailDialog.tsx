import { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useInspectionItems,
  useUpdateInspectionItem,
  useCompleteInspection,
  type Inspection,
  type InspectionItem,
  type InspectionItemResult,
} from "@/hooks/useInspections";
import { EvidenceUpload } from "./EvidenceUpload";
import { InspectionPdfExport } from "./InspectionPdfExport";
import { useCan } from "@/hooks/useCan";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { getInspectionTypeConfig } from "./inspectionConstants";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const resultConfig: Record<
  InspectionItemResult,
  { icon: React.ReactNode; label: string; className: string }
> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    label: "Pendente",
    className: "text-muted-foreground",
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "OK",
    className: "text-green-600",
  },
  rejected: {
    icon: <XCircle className="h-4 w-4" />,
    label: "NC",
    className: "text-destructive",
  },
  not_applicable: {
    icon: <MinusCircle className="h-4 w-4" />,
    label: "N/A",
    className: "text-muted-foreground",
  },
};

interface Props {
  inspection: Inspection;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNc?: (item: InspectionItem) => void;
}

function ItemCard({
  item,
  index,
  isEditable,
  isCompleted,
  projectId,
  inspectionId: _inspectionId,
  itemNotes,
  setItemNotes,
  itemPhotos: _itemPhotos,
  getPhotos,
  handleResultChange,
  handleNotesBlur,
  handlePhotosChange,
  onCreateNc,
  isMobile,
}: {
  item: InspectionItem;
  index: number;
  isEditable: boolean;
  isCompleted: boolean;
  projectId: string;
  inspectionId: string;
  itemNotes: Record<string, string>;
  setItemNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemPhotos: Record<string, string[]>;
  getPhotos: (item: InspectionItem) => string[];
  handleResultChange: (
    item: InspectionItem,
    result: InspectionItemResult,
  ) => void;
  handleNotesBlur: (item: InspectionItem) => void;
  handlePhotosChange: (item: InspectionItem, paths: string[]) => void;
  onCreateNc?: (item: InspectionItem) => void;
  isMobile: boolean;
}) {
  const cfg = resultConfig[item.result];
  const photos = getPhotos(item);

  return (
    <div
      className={cn(
        "border rounded-lg p-3 space-y-3 transition-colors",
        item.result === "rejected" && "border-destructive/30 bg-destructive/5",
        isMobile && "p-4",
      )}
    >
      {/* Description */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">
          {index + 1}.
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            cfg.className,
            isMobile && "text-base",
          )}
        >
          {item.description}
        </span>
      </div>

      {/* Result buttons */}
      {isEditable && (
        <>
          {/* Desktop: individual buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Button
              variant={item.result === "approved" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => handleResultChange(item, "approved")}
              title="Aprovado"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              variant={item.result === "rejected" ? "destructive" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => handleResultChange(item, "rejected")}
              title="Reprovado"
            >
              <XCircle className="h-4 w-4" />
            </Button>
            <Button
              variant={
                item.result === "not_applicable" ? "secondary" : "outline"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => handleResultChange(item, "not_applicable")}
              title="N/A"
            >
              <MinusCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile: large segmented toggle */}
          <div className="flex sm:hidden w-full">
            <div className="inline-flex rounded-xl border bg-muted/50 p-1 w-full gap-1">
              {[
                {
                  value: "approved" as InspectionItemResult,
                  label: "✅ OK",
                  activeClass: "bg-green-600 text-white shadow-sm",
                },
                {
                  value: "rejected" as InspectionItemResult,
                  label: "❌ NC",
                  activeClass:
                    "bg-destructive text-destructive-foreground shadow-sm",
                },
                {
                  value: "not_applicable" as InspectionItemResult,
                  label: "➖ N/A",
                  activeClass: "bg-muted-foreground text-background shadow-sm",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "flex-1 py-3 text-sm font-medium rounded-lg transition-all min-h-[48px] touch-manipulation",
                    item.result === opt.value
                      ? opt.activeClass
                      : "text-muted-foreground active:scale-95",
                  )}
                  onClick={() => handleResultChange(item, opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {isCompleted && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            cfg.className,
          )}
        >
          {cfg.icon}
          {cfg.label}
        </div>
      )}

      {/* Notes */}
      {isEditable ? (
        <Textarea
          placeholder="Observações do item..."
          className="text-xs min-h-[44px] resize-none"
          rows={1}
          value={itemNotes[item.id] ?? item.notes ?? ""}
          onChange={(e) =>
            setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
          }
          onBlur={() => handleNotesBlur(item)}
        />
      ) : item.notes ? (
        <p className="text-xs text-muted-foreground">{item.notes}</p>
      ) : null}

      {/* Evidence photos */}
      <EvidenceUpload
        projectId={projectId}
        entityId={item.id}
        value={photos}
        onChange={(paths) => handlePhotosChange(item, paths)}
        required={item.result === "rejected"}
        disabled={!isEditable}
      />

      {/* Create NC button */}
      {item.result === "rejected" && onCreateNc && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-10 min-w-[44px] w-full sm:w-auto"
          onClick={() => onCreateNc(item)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Abrir NC
        </Button>
      )}
    </div>
  );
}

export function InspectionDetailDialog({
  inspection,
  projectId,
  open,
  onOpenChange,
  onCreateNc,
}: Props) {
  const { can } = useCan();
  const canEdit = can("inspections:edit");
  const isMobile = useIsMobile();
  const { data: items = [], isLoading } = useInspectionItems(inspection.id);
  const updateItem = useUpdateInspectionItem();
  const completeInspection = useCompleteInspection();
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemPhotos, setItemPhotos] = useState<Record<string, string[]>>({});
  const [mobileItemIndex, setMobileItemIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"step" | "list">("step");

  const isCompleted = inspection.status === "completed";
  const isEditable = !isCompleted && canEdit;

  const getPhotos = (item: InspectionItem): string[] => {
    return itemPhotos[item.id] ?? item.photo_paths ?? [];
  };

  const handlePhotosChange = (item: InspectionItem, paths: string[]) => {
    setItemPhotos((prev) => ({ ...prev, [item.id]: paths }));
    updateItem.mutate({
      id: item.id,
      inspection_id: inspection.id,
      photo_paths: paths,
    });
  };

  const handleResultChange = (
    item: InspectionItem,
    result: InspectionItemResult,
  ) => {
    if (isCompleted) return;
    if (result === "rejected") {
      const photos = getPhotos(item);
      if (photos.length === 0) {
        toast.error("Adicione pelo menos uma foto antes de reprovar o item");
        return;
      }
    }
    updateItem.mutate({ id: item.id, inspection_id: inspection.id, result });
  };

  const handleNotesBlur = (item: InspectionItem) => {
    const notes = itemNotes[item.id];
    if (notes !== undefined && notes !== (item.notes || "")) {
      updateItem.mutate({
        id: item.id,
        inspection_id: inspection.id,
        notes: notes || null,
      });
    }
  };

  const hasRejectedWithoutPhotos = useMemo(() => {
    return items.some((i) => {
      if (i.result !== "rejected") return false;
      const photos = getPhotos(i);
      return photos.length === 0;
    });
  }, [items, itemPhotos]);

  const handleComplete = () => {
    const pendingItems = items.filter((i) => i.result === "pending");
    if (pendingItems.length > 0) {
      toast.error(`Ainda há ${pendingItems.length} itens pendentes`);
      return;
    }
    if (hasRejectedWithoutPhotos) {
      toast.error(
        "Todos os itens reprovados devem ter pelo menos uma foto de evidência",
      );
      return;
    }
    completeInspection.mutate({ id: inspection.id, project_id: projectId });
  };

  const approvedCount = items.filter((i) => i.result === "approved").length;
  const rejectedCount = items.filter((i) => i.result === "rejected").length;
  const pendingCount = items.filter((i) => i.result === "pending").length;
  const evaluatedCount = items.length - pendingCount;
  const progressPercent =
    items.length > 0 ? Math.round((evaluatedCount / items.length) * 100) : 0;

  const goToNextItem = useCallback(() => {
    if (mobileItemIndex < items.length - 1)
      setMobileItemIndex((prev) => prev + 1);
  }, [mobileItemIndex, items.length]);

  const goToPrevItem = useCallback(() => {
    if (mobileItemIndex > 0) setMobileItemIndex((prev) => prev - 1);
  }, [mobileItemIndex]);

  // Find next pending item
  const goToNextPending = useCallback(() => {
    const nextPending = items.findIndex(
      (item, idx) => idx > mobileItemIndex && item.result === "pending",
    );
    if (nextPending >= 0) {
      setMobileItemIndex(nextPending);
    } else {
      // Wrap around
      const firstPending = items.findIndex((item) => item.result === "pending");
      if (firstPending >= 0) setMobileItemIndex(firstPending);
    }
  }, [items, mobileItemIndex]);

  const typeConfig = getInspectionTypeConfig(
    inspection.inspection_type || "rotina",
  );

  const headerContent = (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-base">
            Vistoria —{" "}
            {format(parseISO(inspection.inspection_date), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeConfig.color}`}
          >
            {typeConfig.emoji} {typeConfig.label}
          </span>
          <Badge variant={isCompleted ? "secondary" : "default"}>
            {isCompleted ? "Concluída" : "Em andamento"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {inspection.inspector_user_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {inspection.inspector_user_name}
            </span>
          )}
          {inspection.client_present && (
            <span className="flex items-center gap-1">
              🏠 Cliente
              {inspection.client_name ? `: ${inspection.client_name}` : ""}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const progressBar = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {evaluatedCount}/{items.length} avaliados
        </span>
        <div className="flex gap-3">
          <span className="text-green-600 font-medium">{approvedCount} ✓</span>
          <span className="text-destructive font-medium">
            {rejectedCount} ✗
          </span>
          <span>{pendingCount} ⏳</span>
        </div>
      </div>
      <Progress value={progressPercent} className="h-2" />
    </div>
  );

  const itemCardProps = {
    isEditable,
    isCompleted,
    projectId,
    inspectionId: inspection.id,
    itemNotes,
    setItemNotes,
    itemPhotos,
    getPhotos,
    handleResultChange,
    handleNotesBlur,
    handlePhotosChange,
    onCreateNc,
    isMobile,
  };

  // ── Mobile: Full-screen Sheet with step-by-step navigation ──
  if (isMobile) {
    const currentItem = items[mobileItemIndex];

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[95dvh] flex flex-col p-0 rounded-t-2xl"
        >
          {/* Sticky header */}
          <div className="shrink-0 border-b border-border px-4 pt-4 pb-3 space-y-3">
            <SheetHeader className="p-0">
              <SheetTitle className="text-left text-base">
                {typeConfig.emoji} Vistoria{" "}
                {format(parseISO(inspection.inspection_date), "dd/MM", {
                  locale: ptBR,
                })}
              </SheetTitle>
            </SheetHeader>
            {progressBar}

            {/* View mode toggle + step indicator */}
            {isEditable && items.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-colors touch-manipulation",
                      viewMode === "step"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                    onClick={() => setViewMode("step")}
                  >
                    Passo a passo
                  </button>
                  <button
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-colors touch-manipulation",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    Lista
                  </button>
                </div>
                {viewMode === "step" && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {mobileItemIndex + 1} / {items.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 pb-safe">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                Nenhum item no checklist
              </div>
            ) : viewMode === "step" && isEditable ? (
              /* Step-by-step mode */
              <AnimatePresence mode="wait">
                {currentItem && (
                  <motion.div
                    key={currentItem.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ItemCard
                      item={currentItem}
                      index={mobileItemIndex}
                      {...itemCardProps}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              /* List mode / completed view */
              <div className="space-y-3">
                {inspection.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    {inspection.notes}
                  </p>
                )}
                {items.map((item, i) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={i}
                    {...itemCardProps}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border px-4 py-3 pb-safe bg-card/95 backdrop-blur-md space-y-2">
            {viewMode === "step" && isEditable && items.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 touch-manipulation"
                  onClick={goToPrevItem}
                  disabled={mobileItemIndex === 0}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                {pendingCount > 0 &&
                items[mobileItemIndex]?.result !== "pending" ? (
                  <Button
                    variant="secondary"
                    className="flex-1 h-11 touch-manipulation text-sm"
                    onClick={goToNextPending}
                  >
                    Ir ao próximo pendente ({pendingCount})
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="flex-1 h-11 touch-manipulation text-sm"
                    onClick={goToNextItem}
                    disabled={mobileItemIndex >= items.length - 1}
                  >
                    Próximo item
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 touch-manipulation"
                  onClick={goToNextItem}
                  disabled={mobileItemIndex >= items.length - 1}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            {isEditable ? (
              <Button
                onClick={handleComplete}
                disabled={
                  pendingCount > 0 ||
                  hasRejectedWithoutPhotos ||
                  completeInspection.isPending
                }
                className="w-full h-12 text-sm font-medium rounded-xl touch-manipulation"
              >
                {completeInspection.isPending
                  ? "Finalizando..."
                  : `Finalizar Vistoria (${evaluatedCount}/${items.length})`}
              </Button>
            ) : (
              <div className="flex gap-2">
                <InspectionPdfExport inspection={inspection} items={items} />
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-11 touch-manipulation"
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: Dialog (preserved) ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {headerContent}
          </DialogTitle>
        </DialogHeader>

        {progressBar}

        {inspection.notes && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            {inspection.notes}
          </p>
        )}

        {/* Items checklist */}
        <div className="space-y-2">
          {items.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} {...itemCardProps} />
          ))}
        </div>

        <DialogFooter className="gap-2">
          {isCompleted && (
            <InspectionPdfExport inspection={inspection} items={items} />
          )}
          {isEditable ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={handleComplete}
                disabled={
                  pendingCount > 0 ||
                  hasRejectedWithoutPhotos ||
                  completeInspection.isPending
                }
              >
                {completeInspection.isPending
                  ? "Finalizando..."
                  : "Finalizar Vistoria"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
