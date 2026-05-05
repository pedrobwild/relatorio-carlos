import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  X,
  FileText,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FormData } from "./types";

interface BudgetUploadCardProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

const ACCEPTED_EXTENSIONS = ".pdf,.xlsx,.xls,.csv";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BudgetUploadCard({
  file,
  onFileChange,
  formData: _formData,
  onChange,
}: BudgetUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo: 20MB");
      return;
    }
    onFileChange(f);
    onChange("budget_uploaded", true);
    onChange("budget_file_name", f.name);
  };

  const handleRemove = () => {
    onFileChange(null);
    onChange("budget_uploaded", false);
    onChange("budget_file_name", "");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <FileSpreadsheet className="h-5 w-5" />
          Orçamento da Obra
        </CardTitle>
        <CardDescription>
          Opcional — Anexe o orçamento detalhado (PDF, Excel ou CSV) para
          referência comercial e geração futura de cronograma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
            `}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Clique ou arraste o arquivo aqui
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Excel ou CSV • Máx. 20MB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <FileText className="h-6 w-6 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)} · Pronto para envio
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={handleRemove}
              aria-label="Remover arquivo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
