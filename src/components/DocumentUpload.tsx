import { useState } from "react";
import { Upload, X, Loader2, FileText, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { invokeFunctionRaw } from "@/infra/edgeFunctions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES, DocumentCategory } from "@/hooks/useDocuments";
import { z } from "zod";

interface DocumentUploadProps {
  projectId: string;
  onSuccess?: () => void;
}

const uploadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome muito longo"),
  description: z.string().trim().max(1000, "Descrição muito longa").optional(),
  document_type: z.string().min(1, "Selecione uma categoria"),
});

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/zip",
];
const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".zip",
];

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

  const getFileExtension = (filename: string) => {
    const match = filename.toLowerCase().match(/\.[^.]+$/);
    return match ? match[0] : "";
  };

  const isAllowedFile = (selectedFile: File) => {
    if (ACCEPTED_MIME_TYPES.includes(selectedFile.type)) {
      return true;
    }
    const extension = getFileExtension(selectedFile.name);
    return extension ? ACCEPTED_EXTENSIONS.includes(extension) : false;
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size === 0) {
      toast.error("Selecione um arquivo com conteúdo antes de enviar.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      toast.error("O tamanho máximo permitido é 500MB.");
      return;
    }

    if (!isAllowedFile(selectedFile)) {
      toast.error(
        "Envie PDF, Word, Excel, ZIP ou imagens (PNG, JPG, GIF, WEBP).",
      );
      return;
    }

    setFile(selectedFile);
    setErrors((prev) => ({ ...prev, file: "" }));
    if (!formData.name) {
      // Auto-fill name from filename (without extension)
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, name: nameWithoutExt }));
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
        error.errors.forEach((err) => {
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
      // Create form data for edge function
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("projectId", projectId);
      uploadFormData.append("documentType", formData.document_type);
      uploadFormData.append("name", formData.name.trim());
      if (formData.description?.trim()) {
        uploadFormData.append("description", formData.description.trim());
      }

      // Upload via edge function (computes SHA256 checksum server-side)
      const response = await invokeFunctionRaw("document-upload", {
        method: "POST",
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Falha no upload");
      }

      toast.success("Documento enviado e verificado", {
        description: result.document?.checksum
          ? `SHA256: ${result.document.checksum}`
          : undefined,
        duration: 10000,
        action: result.document?.checksum
          ? {
              label: "Copiar",
              onClick: () =>
                navigator.clipboard.writeText(result.document!.checksum!),
            }
          : undefined,
      });

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o documento";
      toast.error(`Erro ao enviar: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="document-upload-button">
          <Upload className="w-4 h-4" />
          Enviar Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="document-upload-modal">
        <DialogHeader>
          <DialogTitle>Enviar Novo Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Drop Zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label={
              file
                ? `Arquivo selecionado: ${file.name}`
                : "Área de upload. Arraste um arquivo ou clique para selecionar"
            }
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            } ${file ? "bg-primary/5 border-primary" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const input = e.currentTarget.querySelector(
                  'input[type="file"]',
                ) as HTMLInputElement;
                input?.click();
              }
            }}
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
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">
                      Tipo: {file.type || "Desconhecido"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Extensão: {getFileExtension(file.name) || "N/A"}
                    </Badge>
                  </div>
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
                  <span className="text-primary underline">
                    clique para selecionar
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                  />
                </label>
                <p className="text-caption text-muted-foreground mt-2">
                  PDF, Word, Excel, ZIP ou imagens (máx. 500MB)
                </p>
              </div>
            )}
            {errors.file && (
              <p className="text-xs text-destructive mt-2">{errors.file}</p>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Boas práticas</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Prefira nomes claros e objetivos para facilitar buscas.</li>
                <li>
                  Evite arquivos duplicados: o sistema identifica checksum
                  automaticamente.
                </li>
              </ul>
            </div>
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, document_type: value }))
              }
            >
              <SelectTrigger
                id="category"
                className={errors.document_type ? "border-destructive" : ""}
                data-testid="document-category-select"
              >
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent position="popper">
                {(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {DOCUMENT_CATEGORIES[key].label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {errors.document_type && (
              <p className="text-xs text-destructive">{errors.document_type}</p>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Documento *</Label>
            <Input
              id="name"
              data-testid="document-name-input"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ex: Contrato de Prestação de Serviços"
              className={errors.name ? "border-destructive" : ""}
              maxLength={200}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Adicione uma descrição ou observações sobre o documento"
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="gap-2"
            >
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
