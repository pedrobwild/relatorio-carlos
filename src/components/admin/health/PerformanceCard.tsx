import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PerformanceCardProps {
  totalLatencyMs: number;
  latencyHistory: number[];
  lastRun: Date | null;
}

export const PerformanceCard = ({
  totalLatencyMs,
  latencyHistory,
  lastRun,
}: PerformanceCardProps) => {
  const avgLatency = latencyHistory.length
    ? Math.round(
        latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length,
      )
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Última execução</p>
            <p className="text-2xl font-bold">{totalLatencyMs}ms</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Média (últimas 5)</p>
            <p className="text-2xl font-bold">{avgLatency}ms</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Execuções</p>
            <p className="text-2xl font-bold">{latencyHistory.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Última atualização</p>
            <p className="text-sm font-medium">
              {lastRun ? lastRun.toLocaleTimeString("pt-BR") : "-"}
            </p>
          </div>
        </div>
        {latencyHistory.length > 0 && (
          <div className="mt-4 flex items-end gap-1 h-12">
            {latencyHistory.map((latency, idx) => (
              <div
                key={idx}
                className="bg-primary rounded-t flex-1"
                style={{
                  height: `${Math.min(100, (latency / Math.max(...latencyHistory)) * 100)}%`,
                  minHeight: "4px",
                }}
                title={`${latency}ms`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
