/**
 * Admin Health & Diagnostics Page
 *
 * Provides system health checks, performance metrics, and diagnostic tools
 * for administrators to quickly identify and troubleshoot issues.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Shield,
  Database,
  HardDrive,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { runFullDiagnostics } from "@/infra/repositories/diagnostics.repository";
import { useUserRole } from "@/hooks/useUserRole";
import { DiagnosticCard } from "@/components/admin/health/DiagnosticCard";
import { BuildInfoCard } from "@/components/admin/health/BuildInfoCard";
import { PerformanceCard } from "@/components/admin/health/PerformanceCard";
import { AdminToolsCard } from "@/components/admin/health/AdminToolsCard";
import { RlsChecksCard } from "@/components/admin/health/RlsChecksCard";
import { AssistantTruncationCard } from "@/components/admin/health/AssistantTruncationCard";
import type { DiagnosticsState } from "@/components/admin/health/types";

export default function AdminHealth() {
  const navigate = useNavigate();
  const { roles, isAdmin } = useUserRole();

  const [state, setState] = useState<DiagnosticsState>({
    loading: false,
    auth: null,
    db: null,
    storage: null,
    rls: null,
    signedUrl: null,
    totalLatencyMs: 0,
    latencyHistory: [],
    lastRun: null,
  });

  const runDiagnostics = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const results = await runFullDiagnostics();
      setState((prev) => ({
        ...prev,
        loading: false,
        auth: results.auth,
        db: results.db,
        storage: results.storage,
        rls: results.rls,
        signedUrl: results.signedUrl,
        totalLatencyMs: results.totalLatencyMs,
        latencyHistory: [
          ...prev.latencyHistory.slice(-4),
          results.totalLatencyMs,
        ],
        lastRun: new Date(),
      }));
      toast({
        title: "Diagnóstico concluído",
        description: `Tempo total: ${results.totalLatencyMs}ms`,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      toast({
        title: "Erro no diagnóstico",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Health & Diagnostics
            </h1>
            <p className="text-muted-foreground mt-1">
              Status do sistema e ferramentas de diagnóstico
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Voltar ao Admin
            </Button>
            <Button onClick={runDiagnostics} disabled={state.loading}>
              <RefreshCw
                className={`w-4 h-4 mr-2 ${state.loading ? "animate-spin" : ""}`}
              />
              {state.loading ? "Executando..." : "Executar Diagnóstico"}
            </Button>
          </div>
        </div>

        <BuildInfoCard />

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DiagnosticCard
            title="Autenticação"
            icon={Shield}
            result={state.auth}
          >
            {state.auth?.userId && (
              <p className="text-xs font-mono text-muted-foreground">
                User: {state.auth.userId.substring(0, 8)}...
              </p>
            )}
          </DiagnosticCard>

          <DiagnosticCard
            title="Banco de Dados"
            icon={Database}
            result={state.db}
          />

          <DiagnosticCard
            title="Storage"
            icon={HardDrive}
            result={state.storage}
          >
            {state.storage?.bucketsAccessible &&
              state.storage.bucketsAccessible.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {state.storage.bucketsAccessible.map((bucket) => (
                    <Badge key={bucket} variant="outline" className="text-xs">
                      {bucket}
                    </Badge>
                  ))}
                </div>
              )}
          </DiagnosticCard>

          <DiagnosticCard
            title="Signed URLs"
            icon={LinkIcon}
            result={state.signedUrl}
          />

          <RlsChecksCard rls={state.rls} />
        </div>

        <PerformanceCard
          totalLatencyMs={state.totalLatencyMs}
          latencyHistory={state.latencyHistory}
          lastRun={state.lastRun}
        />

        <AssistantTruncationCard />

        <AdminToolsCard state={state} roles={roles} isAdmin={isAdmin} />

        {/* Footer with instructions */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">
              Como usar durante incidentes:
            </h3>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>
                Execute o diagnóstico completo clicando em "Executar
                Diagnóstico"
              </li>
              <li>Verifique se todos os checks estão OK (verde)</li>
              <li>Se houver FAIL/WARN, copie o relatório e envie ao suporte</li>
              <li>Se suspeitar de cache corrompido, use "Limpar Caches"</li>
              <li>
                Para validar captura de erros, use "Erro de Teste" (apenas
                dev/staging)
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
