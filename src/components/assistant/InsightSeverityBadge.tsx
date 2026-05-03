import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InsightSeverity } from "@/lib/assistant";

const STYLE: Record<InsightSeverity, string> = {
  info: "bg-muted text-muted-foreground border-border",
  low: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  medium: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  high: "bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  critical: "bg-red-100 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
};

const LABEL: Record<InsightSeverity, string> = {
  info: "Informação",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export function InsightSeverityBadge({ severity }: { severity: InsightSeverity }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", STYLE[severity])}>
      {LABEL[severity]}
    </Badge>
  );
}
