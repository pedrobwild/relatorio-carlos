import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { confidenceLabel } from "@/lib/assistant";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  const Icon =
    label === "alta"
      ? ShieldCheck
      : label === "média"
        ? ShieldQuestion
        : ShieldAlert;
  const tone =
    label === "alta"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : label === "média"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-red-100 text-red-900 border-red-200";
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0 h-5 gap-1", tone)}
      title={`Confiança ${(confidence * 100).toFixed(0)}%`}
    >
      <Icon className="h-3 w-3" />
      Confiança {label}
    </Badge>
  );
}
