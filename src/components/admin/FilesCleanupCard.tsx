import { useState } from "react";
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invokeFunction } from "@/infra/edgeFunctions";

interface CleanupResult {
  success: boolean;
  processed: number;
  deleted: number;
  errors: string[];
  timestamp: string;
}

export function FilesCleanupCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  const runCleanup = async () => {
    setIsLoading(true);
    setLastResult(null);

    try {
      const { data, error } = await invokeFunction("files-cleanup");

      if (error) {
        console.error("[FilesCleanup] Error:", error);
        toast.error("Erro ao executar limpeza", {
          description: error.message,
        });
        return;
      }

      const result = data as CleanupResult;
      setLastResult(result);

      if (result.success) {
        toast.success("Limpeza concluída", {
          description: `${result.deleted} arquivo(s) removido(s) de ${result.processed} processado(s).`,
        });
      } else {
        toast.warning("Limpeza com erros", {
          description: `${result.deleted} removido(s), ${result.errors.length} erro(s).`,
        });
      }
    } catch (err) {
      console.error("[FilesCleanup] Unexpected error:", err);
      toast.error("Erro inesperado", {
        description: "Não foi possível executar a limpeza de arquivos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Limpeza de Arquivos
        </CardTitle>
        <CardDescription>
          Remove fisicamente arquivos expirados ou deletados há mais de 7 dias
          do armazenamento. Esta operação é executada automaticamente por cron,
          mas pode ser disparada manualmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastResult && (
          <div
            className={`p-3 rounded-lg border ${
              lastResult.success
                ? "bg-accent/50 border-accent"
                : "bg-muted border-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium text-sm">
                Última execução:{" "}
                {new Date(lastResult.timestamp).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">
                Processados: {lastResult.processed}
              </Badge>
              <Badge variant="default">Removidos: {lastResult.deleted}</Badge>
              {lastResult.errors.length > 0 && (
                <Badge variant="destructive">
                  Erros: {lastResult.errors.length}
                </Badge>
              )}
            </div>
            {lastResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Ver erros
                </summary>
                <ul className="mt-1 text-xs text-destructive list-disc list-inside">
                  {lastResult.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {lastResult.errors.length > 5 && (
                    <li>...e mais {lastResult.errors.length - 5} erros</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Executar Limpeza Agora
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar limpeza de arquivos</AlertDialogTitle>
              <AlertDialogDescription>
                Esta operação irá remover permanentemente do armazenamento:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Arquivos com status "deleted" há mais de 7 dias</li>
                  <li>Arquivos que passaram da data de expiração</li>
                </ul>
                <p className="mt-2 font-medium">
                  Esta ação não pode ser desfeita.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={runCleanup}>
                Confirmar Limpeza
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
