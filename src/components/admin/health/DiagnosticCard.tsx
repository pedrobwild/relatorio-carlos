import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { DiagnosticResult } from "@/infra/repositories/diagnostics.repository";

interface DiagnosticCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  result: DiagnosticResult | null;
  children?: React.ReactNode;
}

export const DiagnosticCard = ({
  title,
  icon: Icon,
  result,
  children,
}: DiagnosticCardProps) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {result && <StatusBadge status={result.status} />}
      </div>
    </CardHeader>
    <CardContent>
      {result ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{result.message}</p>
          {result.details && (
            <p className="text-xs text-muted-foreground">{result.details}</p>
          )}
          {result.latencyMs !== undefined && (
            <p className="text-xs text-muted-foreground">
              Latência: {result.latencyMs}ms
            </p>
          )}
          {children}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aguardando execução...</p>
      )}
    </CardContent>
  </Card>
);
