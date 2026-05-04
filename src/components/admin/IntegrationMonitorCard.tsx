import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncLog {
  id: string;
  source_system: string;
  target_system: string;
  entity_type: string;
  source_id: string;
  target_id: string | null;
  sync_status: string;
  error_message: string | null;
  ai_diagnosis: string | null;
  corrected_payload: any;
  payload: any;
  attempts: number | null;
  created_at: string;
  synced_at: string | null;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
  }
> = {
  success: { label: "Sucesso", variant: "default", icon: CheckCircle2 },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  auto_corrected: {
    label: "Corrigido IA",
    variant: "secondary",
    icon: Sparkles,
  },
  needs_manual_review: {
    label: "Revisão Manual",
    variant: "outline",
    icon: AlertTriangle,
  },
  pending: { label: "Pendente", variant: "outline", icon: RefreshCw },
};

export function IntegrationMonitorCard() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const {
    data: logs,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["integration-sync-logs", filter],
    queryFn: async () => {
      let query = supabase
        .from("integration_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("sync_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 30000,
  });

  const stats = {
    total: logs?.length ?? 0,
    success: logs?.filter((l) => l.sync_status === "success").length ?? 0,
    failed: logs?.filter((l) => l.sync_status === "failed").length ?? 0,
    corrected:
      logs?.filter(
        (l) =>
          l.sync_status === "auto_corrected" ||
          l.ai_diagnosis?.startsWith("✅"),
      ).length ?? 0,
    review:
      logs?.filter((l) => l.sync_status === "needs_manual_review").length ?? 0,
  };

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-medium">Monitor de Integrações</h3>
            <p className="text-sm text-muted-foreground">
              Sincronização automática com IA entre Portal BWild e Envision
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-b">
        <StatCard label="Total" value={stats.total} />
        <StatCard
          label="Sucesso"
          value={stats.success}
          color="text-green-600"
        />
        <StatCard label="Falhas" value={stats.failed} color="text-red-600" />
        <StatCard
          label="Corrigidos IA"
          value={stats.corrected}
          color="text-purple-600"
        />
        <StatCard label="Revisão" value={stats.review} color="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="p-3 border-b flex gap-2 flex-wrap">
        {[
          { value: "all", label: "Todos" },
          { value: "success", label: "Sucesso" },
          { value: "failed", label: "Falhas" },
          { value: "needs_manual_review", label: "Revisão" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Logs */}
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : !logs?.length ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum registro de sincronização encontrado
          </div>
        ) : (
          logs.map((log) => {
            const config =
              statusConfig[log.sync_status] ?? statusConfig.pending;
            const Icon = config.icon;
            const isExpanded = expandedId === log.id;

            return (
              <Collapsible
                key={log.id}
                open={isExpanded}
                onOpenChange={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <CollapsibleTrigger className="w-full p-3 hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        log.sync_status === "success"
                          ? "text-green-600"
                          : log.sync_status === "failed"
                            ? "text-red-600"
                            : log.sync_status === "needs_manual_review"
                              ? "text-amber-600"
                              : "text-purple-600"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm capitalize">
                          {log.entity_type}
                        </span>
                        <Badge variant={config.variant} className="text-xs">
                          {config.label}
                        </Badge>
                        {log.ai_diagnosis && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Sparkles className="h-3 w-3" />
                            IA
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {log.source_system} → {log.target_system}
                        {log.error_message &&
                          ` • ${log.error_message.slice(0, 60)}...`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {log.created_at
                          ? format(new Date(log.created_at), "dd/MM HH:mm", {
                              locale: ptBR,
                            })
                          : "—"}
                      </p>
                      {log.attempts && log.attempts > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {log.attempts} tentativas
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-3">
                    {/* Error */}
                    {log.error_message && (
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-xs font-medium text-red-700 mb-1">
                          Erro
                        </p>
                        <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                          {log.error_message}
                        </p>
                      </div>
                    )}

                    {/* AI Diagnosis */}
                    {log.ai_diagnosis && (
                      <div className="bg-purple-50 rounded p-3">
                        <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Diagnóstico IA
                        </p>
                        <p className="text-xs text-purple-600 whitespace-pre-wrap">
                          {log.ai_diagnosis}
                        </p>
                      </div>
                    )}

                    {/* Payloads */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.payload && (
                        <div className="bg-muted/50 rounded p-3">
                          <p className="text-xs font-medium mb-1">
                            Payload Original
                          </p>
                          <pre className="text-xs font-mono overflow-auto max-h-40">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.corrected_payload && (
                        <div className="bg-green-50 rounded p-3">
                          <p className="text-xs font-medium text-green-700 mb-1">
                            Payload Corrigido
                          </p>
                          <pre className="text-xs font-mono overflow-auto max-h-40 text-green-600">
                            {JSON.stringify(log.corrected_payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        Source ID:{" "}
                        <code className="bg-muted px-1 rounded">
                          {log.source_id}
                        </code>
                      </span>
                      {log.target_id && (
                        <span>
                          Target ID:{" "}
                          <code className="bg-muted px-1 rounded">
                            {log.target_id}
                          </code>
                        </span>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <p className={`text-xl font-bold ${color ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
