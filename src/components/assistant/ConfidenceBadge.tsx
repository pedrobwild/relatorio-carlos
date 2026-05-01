import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { confidenceLabel } from "@/lib/assistant";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  const Icon = label === "alta" ? ShieldCheck : label === "média" ? ShieldQuestion : ShieldAlert;
  const tone =
    label === "alta"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900"
      : label === "média"
      ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900"
      : "bg-red-100 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900";
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1", tone)} title={`Confiança ${(confidence * 100).toFixed(0)}%`}>
      <Icon className="h-3 w-3" />
      Confiança {label}
    </Badge>
  );
}
