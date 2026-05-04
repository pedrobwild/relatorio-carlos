import { Shield, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { RlsCheckResult } from "@/infra/repositories/diagnostics.repository";

interface RlsChecksCardProps {
  rls: RlsCheckResult | null;
}

export const RlsChecksCard = ({ rls }: RlsChecksCardProps) => (
  <Card className="md:col-span-2">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">RLS Checks</CardTitle>
        </div>
        {rls && <StatusBadge status={rls.status} />}
      </div>
    </CardHeader>
    <CardContent>
      {rls ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{rls.message}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {rls.checks.map((check, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-md border ${check.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
              >
                <div className="flex items-center gap-2">
                  {check.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">{check.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {check.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aguardando execução...</p>
      )}
    </CardContent>
  </Card>
);
