/**
 * AssistantTruncationCard
 *
 * Mostra a taxa de respostas truncadas do assistente nas últimas 24h e
 * destaca quando ultrapassa o limite. Visível apenas para staff/admin.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface TruncationStats {
  total_responses: number;
  truncated_count: number;
  truncation_rate: number; // %
  avg_answer_length: number | null;
  recent_truncated_at: string | null;
}

const ALERT_THRESHOLD_PCT = 5; // > 5% dispara alerta

export function AssistantTruncationCard() {
  const [stats, setStats] = useState<TruncationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "assistant_truncation_stats" as any,
      { hours_back: 24 },
    );
    setLoading(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setStats(row as TruncationStats);
  };

  useEffect(() => {
    void load();
  }, []);

  const rate = stats?.truncation_rate ?? 0;
  const isAlert = rate > ALERT_THRESHOLD_PCT;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Qualidade do assistente (24h)
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Erro: {error}</p>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  isAlert ? "text-destructive" : "text-foreground"
                }`}
              >
                {rate}%
              </span>
              <span className="text-xs text-muted-foreground">
                respostas truncadas
              </span>
              {isAlert && (
                <Badge variant="destructive" className="ml-auto gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Acima do limite ({ALERT_THRESHOLD_PCT}%)
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{stats.total_responses}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Truncadas</p>
                <p className="font-medium">{stats.truncated_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tamanho médio</p>
                <p className="font-medium">
                  {stats.avg_answer_length ?? "—"} chars
                </p>
              </div>
            </div>
            {stats.recent_truncated_at && (
              <p className="text-xs text-muted-foreground">
                Último incidente:{" "}
                {new Date(stats.recent_truncated_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
