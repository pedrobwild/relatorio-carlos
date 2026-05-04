import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  Loader2,
  FileText,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import OrcamentoDetalhe from "@/pages/gestao/OrcamentoDetalhe";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OrcamentoProjeto() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("name, client_name")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: orcamento, isLoading } = useQuery({
    queryKey: queryKeys.orcamentos.byProject(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (
      !ext.endsWith(".pdf") &&
      !ext.endsWith(".xlsx") &&
      !ext.endsWith(".xls") &&
      !ext.endsWith(".csv")
    ) {
      toast.error("Formato não suportado. Use PDF, Excel ou CSV.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 20MB");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file || !projectId) return;

    setImporting(true);
    setProgress(10);
    setStatusText("Enviando arquivo...");

    try {
      // 1. Upload to storage
      const storagePath = `${projectId}/orcamento-import/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(storagePath, file);

      if (uploadError) {
        throw new Error("Falha no upload: " + uploadError.message);
      }

      setProgress(30);
      setStatusText("Analisando orçamento com IA...");

      // 2. Call edge function
      const { data, error } = await supabase.functions.invoke(
        "parse-budget-pdf",
        {
          body: {
            project_id: projectId,
            storage_path: storagePath,
            project_name: project?.name || "",
            client_name: project?.client_name || "",
          },
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProgress(90);
      setStatusText("Finalizando importação...");

      // 3. Invalidate cache
      await queryClient.invalidateQueries({
        queryKey: queryKeys.orcamentos.byProject(projectId),
      });

      setProgress(100);
      setStatusText("Concluído!");
      toast.success(data.message || "Orçamento importado com sucesso!");
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao importar orçamento");
      setProgress(0);
      setStatusText("");
    } finally {
      setTimeout(() => {
        setImporting(false);
        setFile(null);
        setProgress(0);
        setStatusText("");
      }, 1500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 px-4 max-w-lg mx-auto">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Nenhum orçamento vinculado
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Importe um orçamento em PDF e a IA irá adaptá-lo ao modelo do
            sistema automaticamente.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Importar Orçamento com IA
            </CardTitle>
            <CardDescription>
              Envie o PDF do orçamento — a IA extrairá seções e itens
              automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            {importing ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">{statusText}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ) : !file ? (
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
                    PDF, Excel ou CSV · Máx. 20MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <FileSpreadsheet className="h-6 w-6 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => setFile(null)}
                    aria-label="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleImport} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Importar com IA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          O orçamento também pode ser sincronizado automaticamente pelo sistema
          comercial.
        </p>
      </div>
    );
  }

  return <OrcamentoDetalhe embeddedOrcamentoId={orcamento.id} />;
}
