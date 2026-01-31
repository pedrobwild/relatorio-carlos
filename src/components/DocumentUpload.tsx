import { useState } from "react";
import { Upload, X, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { DOCUMENT_CATEGORIES, DocumentCategory } from "@/hooks/useDocuments";
import { z } from "zod";

interface DocumentUploadProps {
  projectId: string;
  onSuccess?: () => void;
}

const uploadSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  description: z.string().trim().max(1000, "Descrição muito longa").optional(),
  document_type: z.string().min(1, "Selecione uma categoria"),
});

export function DocumentUpload({ projectId, onSuccess }: DocumentUploadProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    document_type: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFile(null);
    setFormData({ name: "", description: "", document_type: "" });
    setErrors({});
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
    if (!formData.name) {
      // Auto-fill name from filename (without extension)
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, name: nameWithoutExt }));
    }
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

  const validateForm = (): boolean => {
    try {
      uploadSchema.parse(formData);
      if (!file) {
        setErrors({ file: "Selecione um arquivo" });
        return false;
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleUpload = async () => {
    if (!validateForm() || !file || !user) return;

    setUploading(true);

    try {
      // Get auth session for authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Create form data for edge function
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('projectId', projectId);
      uploadFormData.append('documentType', formData.document_type);
      uploadFormData.append('name', formData.name.trim());
      if (formData.description?.trim()) {
        uploadFormData.append('description', formData.description.trim());
      }

      // Upload via edge function (computes SHA256 checksum server-side)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-upload`,
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
        throw new Error(result.error || 'Falha no upload');
      }

      toast({
        title: "Documento enviado",
        description: `Documento verificado (checksum: ${result.document?.checksum?.substring(0, 8)}...)`,
      });

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível enviar o documento";
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
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Enviar Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Novo Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
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
                <p className="text-body">Arraste um arquivo ou</p>
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
            {errors.file && <p className="text-xs text-destructive mt-2">{errors.file}</p>}
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, document_type: value }))}
            >
              <SelectTrigger id="category" className={errors.document_type ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {DOCUMENT_CATEGORIES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.document_type && <p className="text-xs text-destructive">{errors.document_type}</p>}
          </div>

          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Documento *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Contrato de Prestação de Serviços"
              className={errors.name ? "border-destructive" : ""}
              maxLength={200}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Adicione uma descrição ou observações sobre o documento"
              rows={3}
              maxLength={1000}
            />
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
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
