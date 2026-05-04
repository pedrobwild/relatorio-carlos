import { Badge } from"@/components/ui/badge";
import { cn } from"@/lib/utils";
import type { InsightSeverity } from"@/lib/assistant";

const STYLE: Record<InsightSeverity, string> = {
 info:"bg-muted text-muted-foreground border-border",
 low:"bg-sky-100 text-sky-900 border-sky-200",
 medium:"bg-amber-100 text-amber-900 border-amber-200",
 high:"bg-orange-100 text-orange-900 border-orange-200",
 critical:"bg-red-100 text-red-900 border-red-200",
};

const LABEL: Record<InsightSeverity, string> = {
 info:"Informação",
 low:"Baixa",
 medium:"Média",
 high:"Alta",
 critical:"Crítica",
};

export function InsightSeverityBadge({ severity }: { severity: InsightSeverity }) {
 return (
 <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", STYLE[severity])}>
 {LABEL[severity]}
 </Badge>
 );
}
