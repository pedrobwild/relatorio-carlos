import { useRef, useState } from "react";
import { Upload, Eye, Download, File, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  uploadFormalizationAttachment,
  getAttachmentUrl,
  downloadAttachment,
  validateFile,
  formatFileSize,
  getFileTypeLabel,
  isImageFile,
} from "@/lib/formalizationStorage";

interface Attachment {
  id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface AttachmentsCardProps {
  formalizationId: string;
  attachments: Attachment[];
}

function getFileIcon(mimeType: string) {
  if (isImageFile(mimeType)) return <Image className="h-5 w-5" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

export function AttachmentsCard({
  formalizationId,
  attachments,
}: AttachmentsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    mimeType: string;
    storagePath: string;
  } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: "Arquivo inválido",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      await uploadFormalizationAttachment(formalizationId, file);
      toast({
        title: "Arquivo enviado",
        description: `${file.name} foi anexado com sucesso.`,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(formalizationId),
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    try {
      const downloaded = await downloadAttachment(storagePath, filename);
      if (!downloaded) throw new Error("Falha ao gerar URL de download");
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível baixar o arquivo.",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (
    attachmentId: string,
    storagePath: string,
    filename: string,
    mimeType: string,
  ) => {
    setPreviewOpen(true);
    setPreviewingId(attachmentId);
    setPreviewUrl(null);
    setPreviewFile({ name: filename, mimeType, storagePath });
    const url = await getAttachmentUrl(storagePath);
    if (!url) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar a pré-visualização do anexo.",
        variant: "destructive",
      });
      setPreviewingId(null);
      setPreviewOpen(false);
      return;
    }
    setPreviewUrl(url);
    setPreviewingId(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Anexos</CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Adicionar anexo"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando..." : "Adicionar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum anexo adicionado
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(attachment.mime_type)}
                    <div>
                      <p className="font-medium text-sm">
                        {attachment.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getFileTypeLabel(attachment.mime_type)} •{" "}
                        {formatFileSize(attachment.size_bytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handlePreview(
                          attachment.id,
                          attachment.storage_path,
                          attachment.original_filename,
                          attachment.mime_type,
                        )
                      }
                      aria-label={`Pré-visualizar ${attachment.original_filename}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleDownload(
                          attachment.storage_path,
                          attachment.original_filename,
                        )
                      }
                      aria-label={`Baixar ${attachment.original_filename}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewUrl(null);
            setPreviewFile(null);
            setPreviewingId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <DialogTitle className="text-base truncate">
              {previewFile?.name ?? "Pré-visualização do anexo"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewingId ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : previewUrl && previewFile ? (
              <DocumentViewer
                url={previewUrl}
                title={previewFile.name}
                mimeType={previewFile.mimeType}
                className="h-full rounded-none border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground">
                  Não foi possível carregar a pré-visualização.
                </p>
                {previewFile && (
                  <Button
                    onClick={() =>
                      handleDownload(previewFile.storagePath, previewFile.name)
                    }
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
