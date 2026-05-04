import { useCallback } from "react";
import {
  FileText,
  Trash2,
  Bug,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getBuildInfo, isDev, getSentryProjectUrl } from "@/lib/buildInfo";
import { captureException } from "@/lib/errorMonitoring";
import { QUERY_CACHE_VERSION } from "@/lib/queryPersister";
import type { DiagnosticsState } from "./types";

interface AdminToolsCardProps {
  state: DiagnosticsState;
  roles: string[];
  isAdmin: boolean;
}

export const AdminToolsCard = ({
  state,
  roles,
  isAdmin,
}: AdminToolsCardProps) => {
  const buildInfo = getBuildInfo();
  const sentryUrl = getSentryProjectUrl();

  const clearLocalCaches = useCallback(() => {
    try {
      queryClient.clear();

      const keysToRemove = [
        `bwild-query-cache-v${QUERY_CACHE_VERSION}`,
        "portalViewState",
        "onboarding:",
        "supabase.auth.token",
      ];

      const allKeys = Object.keys(localStorage);
      let removedCount = 0;

      allKeys.forEach((key) => {
        if (
          keysToRemove.some(
            (pattern) => key.startsWith(pattern) || key.includes(pattern),
          )
        ) {
          localStorage.removeItem(key);
          removedCount++;
        }
      });

      toast({
        title: "Caches limpos",
        description: `${removedCount} itens removidos. Recarregando...`,
      });

      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: "Erro ao limpar cache",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, []);

  const copyDiagnosticReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      build: {
        commit: buildInfo.commit,
        branch: buildInfo.branch,
        environment: buildInfo.environment,
        version: buildInfo.version,
      },
      user: {
        id: state.auth?.userId || "unknown",
        roles,
        isAdmin,
      },
      route: window.location.pathname,
      checks: {
        auth: state.auth
          ? { status: state.auth.status, message: state.auth.message }
          : null,
        db: state.db
          ? {
              status: state.db.status,
              message: state.db.message,
              latencyMs: state.db.latencyMs,
            }
          : null,
        storage: state.storage
          ? { status: state.storage.status, message: state.storage.message }
          : null,
        rls: state.rls
          ? {
              status: state.rls.status,
              message: state.rls.message,
              checksCount: state.rls.checks.length,
              passedCount: state.rls.checks.filter((c) => c.passed).length,
            }
          : null,
        signedUrl: state.signedUrl
          ? { status: state.signedUrl.status, message: state.signedUrl.message }
          : null,
      },
      performance: {
        totalLatencyMs: state.totalLatencyMs,
        avgLatencyMs: state.latencyHistory.length
          ? Math.round(
              state.latencyHistory.reduce((a, b) => a + b, 0) /
                state.latencyHistory.length,
            )
          : null,
        lastRun: state.lastRun?.toISOString() || null,
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast({
      title: "Relatório copiado",
      description: "JSON do diagnóstico copiado para a área de transferência",
    });
  }, [buildInfo, state, roles, isAdmin]);

  const emitTestError = useCallback(() => {
    if (!isDev() && buildInfo.environment === "production") {
      toast({
        title: "Não permitido",
        description: "Eventos de teste só podem ser emitidos em dev/staging",
        variant: "destructive",
      });
      return;
    }

    try {
      captureException(new Error("[TEST] Health check diagnostic error"), {
        feature: "diagnostics",
        action: "test_error",
        extra: { triggeredAt: new Date().toISOString() },
      });
      toast({
        title: "Erro de teste emitido",
        description: "Verifique o console e/ou Sentry",
      });
    } catch (error) {
      toast({
        title: "Falha ao emitir erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [buildInfo.environment]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ferramentas de Admin</CardTitle>
        <CardDescription>Ações de diagnóstico e manutenção</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={copyDiagnosticReport}
          >
            <FileText className="w-5 h-5" />
            <span>Copiar Relatório</span>
            <span className="text-xs text-muted-foreground">
              JSON para suporte
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={clearLocalCaches}
          >
            <Trash2 className="w-5 h-5" />
            <span>Limpar Caches</span>
            <span className="text-xs text-muted-foreground">
              Query + localStorage
            </span>
          </Button>

          {(isDev() || buildInfo.environment !== "production") && (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={emitTestError}
            >
              <Bug className="w-5 h-5" />
              <span>Erro de Teste</span>
              <span className="text-xs text-muted-foreground">
                Validar captura
              </span>
            </Button>
          )}

          {sentryUrl ? (
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => window.open(sentryUrl, "_blank")}
            >
              <ExternalLink className="w-5 h-5" />
              <span>Abrir Sentry</span>
              <span className="text-xs text-muted-foreground">
                Dashboard de erros
              </span>
            </Button>
          ) : (
            <div className="border rounded-md p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">Sentry não configurado</span>
              <span className="text-xs">Defina VITE_SENTRY_PROJECT_URL</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
