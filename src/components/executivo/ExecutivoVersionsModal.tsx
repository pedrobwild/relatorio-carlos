import { useState, useRef, useCallback } from "react";
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
  FileText,
  Loader2,
  Upload,
  X,
  Eye,
  MessageSquareWarning,
  Download,
} from "lucide-react";
import {
  useExecutivoVersions,
  type ExecutivoVersion,
} from "@/hooks/useExecutivoVersions";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ExecutivoPDFViewerModal } from "./ExecutivoPDFViewerModal";
import { journeyRepo, projectsRepo } from "@/infra/repositories";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutivoVersionsModal({
  projectId,
  open,
  onOpenChange,
}: Props) {
  const { versions, loading, createVersion, isCreating, refetch } =
    useExecutivoVersions(projectId);
  const { isStaff } = useUserRole();
  const { user } = useAuth();
  const [uploadMode, setUploadMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewerVersionId, setViewerVersionId] = useState<string | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (
        !file.name.toLowerCase().endsWith(".pdf") &&
        file.type !== "application/pdf"
      ) {
        toast.error("Apenas arquivos PDF são aceitos.");
        return;
      }
      setSelectedFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    try {
      await createVersion(selectedFile);
      setSelectedFile(null);
      setUploadMode(false);
    } catch {
      /* error handled by mutation */
    }
  }, [selectedFile, createVersion]);

  const handleRequestRevision = useCallback(async () => {
    if (!revisionTarget || !user) return;
    setIsRequesting(true);
    try {
      const { error } = await journeyRepo.requestRevision(
        revisionTarget,
        user.id,
      );
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

  const handleDownload = useCallback(async (version: ExecutivoVersion) => {
    setDownloadingId(version.id);
    try {
      const storagePath = await projectsRepo.get3DFilePaths(version.id);
      if (!storagePath) throw new Error("Arquivo não encontrado");

      const blob = await projectsRepo.downloadStorageFile(
        "project-documents",
        storagePath,
      );
      if (!blob) throw new Error("Erro ao baixar arquivo");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projeto-executivo-v${version.version_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao baixar arquivo");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <>
      <Dialog open={open && !viewerVersionId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">
                Versões do Projeto Executivo
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
                  <h4 className="text-sm font-medium">Upload de PDF</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setUploadMode(false);
                      setSelectedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Selecionar arquivo PDF
                </Button>

                {selectedFile && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-card rounded px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleUpload}
                      disabled={isCreating}
                      className="w-full gap-2"
                    >
                      {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isCreating ? "Enviando..." : "Criar versão"}
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
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
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
                        disabled={downloadingId === version.id}
                        onClick={() => handleDownload(version)}
                      >
                        {downloadingId === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Baixar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setViewerVersionId(version.id)}
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

      {/* PDF Viewer Modal */}
      {viewerVersionId && (
        <ExecutivoPDFViewerModal
          versionId={viewerVersionId}
          open={!!viewerVersionId}
          onOpenChange={(open) => {
            if (!open) setViewerVersionId(null);
          }}
        />
      )}
    </>
  );
}
