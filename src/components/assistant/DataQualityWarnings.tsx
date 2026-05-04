import { AlertTriangle } from "lucide-react";
import type { DataQualityWarning } from "@/lib/assistant";
import { InsightSeverityBadge } from "./InsightSeverityBadge";

export function DataQualityWarnings({
  warnings,
}: {
  warnings: DataQualityWarning[];
}) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-sm font-semibold">Qualidade dos dados</p>
      </div>
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="text-xs flex items-start gap-2">
            <InsightSeverityBadge severity={w.severity} />
            <span className="text-foreground/90">{w.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
