import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ImageIcon,
  Loader2,
  Upload,
  X,
  Eye,
  MessageSquareWarning,
} from "lucide-react";
import { use3DVersions, type Version3D } from "@/hooks/use3DVersions";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CarouselModal } from "./CarouselModal";
import {
  get3DImageCounts,
  requestRevision,
} from "@/infra/repositories/journey.repository";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionsListModal({ projectId, open, onOpenChange }: Props) {
  const { versions, loading, createVersion, isCreating, refetch } =
    use3DVersions(projectId);
  const { user } = useAuth();
  const { isStaff } = useUserRole();
  const [uploadMode, setUploadMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [carouselVersionId, setCarouselVersionId] = useState<string | null>(
    null,
  );
  const [imageCountsCache, setImageCountsCache] = useState<
    Record<string, number>
  >({});
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || versions.length === 0) return;
    let cancelled = false;

    const loadCounts = async () => {
      const ids = versions.map((v) => v.id);
      const counts = await get3DImageCounts(ids);
      if (!cancelled) {
        setImageCountsCache(counts);
      }
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [open, versions]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const invalid = files.filter((f) => {
        const isPngExt = f.name.toLowerCase().endsWith(".png");
        const isPngMime = f.type === "image/png";
        return !isPngExt && !isPngMime;
      });
      if (invalid.length > 0) {
        toast.error(
          `Apenas arquivos .png são aceitos. Rejeitados: ${invalid.map((f) => f.name).join(", ")}`,
        );
        return;
      }
      setSelectedFiles((prev) => [...prev, ...files]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecione ao menos uma imagem .png");
      return;
    }
    try {
      await createVersion(selectedFiles);
      setSelectedFiles([]);
      setUploadMode(false);
      setImageCountsCache({});
    } catch {
      // Error already handled in hook
    }
  }, [selectedFiles, createVersion]);

  const handleRequestRevision = useCallback(async () => {
    if (!revisionTarget || !user) return;
    setIsRequesting(true);
    try {
      const { error } = await requestRevision(revisionTarget, user.id);
      if (error) throw error;
      toast.success("Solicitação de revisão enviada");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar revisão");
    } finally {
      setIsRequesting(false);
      setRevisionTarget(null);
    }
  }, [revisionTarget, user, refetch]);

  return (
    <>
      <Dialog open={open && !carouselVersionId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">
                Versões do Projeto 3D
              </DialogTitle>
              {isStaff && !uploadMode && (
                <Button
                  size="sm"
                  onClick={() => setUploadMode(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Nova versão
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Upload Mode */}
            {uploadMode && (
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Upload de imagens (.png)
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setUploadMode(false);
                      setSelectedFiles([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,image/png"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Selecionar imagens .png
                </Button>

                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="flex items-center justify-between bg-card rounded px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(1)}MB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveFile(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={handleUpload}
                      disabled={isCreating}
                      className="w-full gap-2 mt-2"
                    >
                      {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isCreating
                        ? "Enviando..."
                        : `Criar versão com ${selectedFiles.length} imagen${selectedFiles.length > 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Versions list */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma versão cadastrada
                </p>
                {isStaff && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em "Nova versão" para começar
                  </p>
                )}
              </div>
            ) : (
              versions.map((version) => (
                <div key={version.id} className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          Versão {version.version_number}
                        </p>
                        {version.revision_requested_at && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]"
                          >
                            Revisão solicitada
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(version.created_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR },
                        )}
                        {imageCountsCache[version.id] != null && (
                          <>
                            {" "}
                            • {imageCountsCache[version.id]} imagen
                            {imageCountsCache[version.id] !== 1 ? "s" : ""}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isStaff && !version.revision_requested_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)] hover:bg-[hsl(var(--warning-light))]"
                          onClick={() => setRevisionTarget(version.id)}
                        >
                          <MessageSquareWarning className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            Solicitar revisão
                          </span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setCarouselVersionId(version.id)}
                      >
                        <Eye className="h-4 w-4" />
                        Abrir
                      </Button>
                    </div>
                  </div>

                  {/* Inline revision confirmation */}
                  {revisionTarget === version.id && (
                    <div className="rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning-light))] p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Solicitar revisão</p>
                        <p className="text-xs text-muted-foreground">
                          Você já fez todos os apontamentos que gostaria? Ao
                          confirmar, a equipe será notificada para revisar esta
                          versão.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRequesting}
                          onClick={() => setRevisionTarget(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          disabled={isRequesting}
                          onClick={handleRequestRevision}
                        >
                          {isRequesting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          ) : null}
                          Confirmar solicitação
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Carousel Modal */}
      {carouselVersionId && (
        <CarouselModal
          versionId={carouselVersionId}
          open={!!carouselVersionId}
          onOpenChange={(open) => {
            if (!open) setCarouselVersionId(null);
          }}
        />
      )}
    </>
  );
}
