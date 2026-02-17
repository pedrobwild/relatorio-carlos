import { useState } from "react";
import { Upload, X, Loader2, FileText, CheckCircle2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { ProjectDocument } from "@/hooks/useDocuments";

interface DocumentVersionUploadProps {
  document: ProjectDocument;
  onSuccess?: () => void;
}

export function DocumentVersionUpload({ document, onSuccess }: DocumentVersionUploadProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");

  const resetForm = () => {
    setFile(null);
    setChangeNotes("");
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size > 500 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 500MB",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('parentDocumentId', document.id);
      if (changeNotes.trim()) {
        uploadFormData.append('changeNotes', changeNotes.trim());
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-version-upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: uploadFormData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409 && result.duplicateVersion) {
          throw new Error(`Este arquivo já existe como versão ${result.duplicateVersion}`);
        }
        throw new Error(result.error || 'Falha no upload');
      }

      toast({
        title: "Nova versão enviada",
        description: `Versão ${result.document?.version} criada com checksum verificado`,
      });

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Version upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível enviar a nova versão";
      toast({
        title: "Erro ao enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <History className="w-3.5 h-3.5" />
          Nova Versão
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Enviar Nova Versão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Current document info */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-caption text-muted-foreground mb-1">Documento atual</p>
            <p className="text-body font-medium">{document.name}</p>
            <div className="flex items-center gap-3 mt-1 text-caption text-muted-foreground">
              <span>Versão {document.version}</span>
              {document.checksum && (
                <span className="font-mono text-xs">
                  SHA256: {document.checksum.substring(0, 12)}...
                </span>
              )}
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            } ${file ? "bg-primary/5 border-primary" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{file.name}</p>
                  <p className="text-caption text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-body">Arraste o novo arquivo ou</p>
                <label className="cursor-pointer">
                  <span className="text-primary underline">clique para selecionar</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                  />
                </label>
                <p className="text-caption text-muted-foreground mt-2">
                  PDF, Word, Excel, ZIP ou imagens (máx. 50MB)
                </p>
              </div>
            )}
          </div>

          {/* Change Notes */}
          <div className="space-y-2">
            <Label htmlFor="changeNotes">Notas da alteração (opcional)</Label>
            <Textarea
              id="changeNotes"
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="Descreva as alterações nesta versão..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {changeNotes.length}/500 caracteres
            </p>
          </div>

          {/* Info about versioning */}
          <div className="p-3 bg-info-light dark:bg-[hsl(var(--info))]/10 rounded-lg text-caption border border-[hsl(var(--info))]/20">
            <p className="text-[hsl(var(--info))]">
              <strong>Controle de versão:</strong> O sistema calculará automaticamente 
              o checksum SHA256 para verificação de integridade. Arquivos duplicados 
              serão detectados e rejeitados.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Enviar Versão {document.version + 1}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
