import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { ScrollArea } from"@/components/ui/scroll-area";
import { AlertTriangle, AlertCircle, Clock, Bell, ChevronRight, X } from"lucide-react";
import { ProjectPurchase } from"@/hooks/useProjectPurchases";
import { PurchaseAlertBadge } from"./PurchaseAlertBadge";
import { format } from"date-fns";
import { ptBR } from"date-fns/locale";
import { useState } from"react";
import { cn } from"@/lib/utils";

interface PurchaseAlertsPanelProps {
 alertThresholds: {
 overdue: ProjectPurchase[];
 critical: ProjectPurchase[];
 warning: ProjectPurchase[];
 approaching: ProjectPurchase[];
 };
 getDaysUntilDeadline: (purchase: ProjectPurchase) => number;
 onItemClick?: (purchase: ProjectPurchase) => void;
 collapsible?: boolean;
}

export function PurchaseAlertsPanel({
 alertThresholds,
 getDaysUntilDeadline,
 onItemClick,
 collapsible = true,
}: PurchaseAlertsPanelProps) {
 const [isExpanded, setIsExpanded] = useState(true);
 
 const { overdue, critical, warning, approaching } = alertThresholds;
 const totalAlerts = overdue.length + critical.length + warning.length + approaching.length;

 if (totalAlerts === 0) {
 return (
 <Card className="border-[hsl(var(--success))]/20 bg-success-light/50">
 <CardContent className="py-4">
 <div className="flex items-center gap-2 text-[hsl(var(--success))]">
 <Bell className="h-4 w-4" />
 <span className="text-sm font-medium">Nenhum alerta de prazo</span>
 </div>
 </CardContent>
 </Card>
 );
 }

 const renderAlertSection = (
 items: ProjectPurchase[],
 title: string,
 icon: React.ElementType,
 urgencyLevel:'overdue' |'critical' |'warning' |'approaching',
 colorClasses: string
 ) => {
 if (items.length === 0) return null;

 const Icon = icon;

 return (
 <div className="space-y-2">
 <div className={cn("flex items-center gap-2 text-sm font-medium", colorClasses)}>
 <Icon className="h-4 w-4" />
 <span>{title} ({items.length})</span>
 </div>
 <div className="space-y-1.5 ml-6">
 {items.slice(0, 5).map((purchase) => (
 <div
 key={purchase.id}
 className={cn(
"flex items-center justify-between p-2 rounded-md text-sm cursor-pointer",
"hover:bg-accent/50 transition-colors",
 urgencyLevel ==='overdue' &&"bg-destructive/5",
 urgencyLevel ==='critical' &&"bg-destructive/5",
 urgencyLevel ==='warning' &&"bg-warning/5",
 )}
 onClick={() => onItemClick?.(purchase)}
 >
 <div className="flex-1 min-w-0">
 <p className="font-medium truncate">{purchase.item_name}</p>
 <p className="text-xs text-muted-foreground">
 Prazo: {format(new Date(purchase.required_by_date),"dd/MM/yyyy", { locale: ptBR })}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <PurchaseAlertBadge 
 urgencyLevel={urgencyLevel} 
 daysUntil={getDaysUntilDeadline(purchase)}
 size="sm"
 />
 <ChevronRight className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 ))}
 {items.length > 5 && (
 <p className="text-xs text-muted-foreground text-center py-1">
 +{items.length - 5} item(s)
 </p>
 )}
 </div>
 </div>
 );
 };

 return (
 <Card className="border-[hsl(var(--warning))]/20">
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between">
 <CardTitle className="text-base flex items-center gap-2">
 <Bell className="h-4 w-4 text-[hsl(var(--warning))]" />
 Alertas de Prazo
 <Badge variant="secondary" className="ml-1">
 {totalAlerts}
 </Badge>
 </CardTitle>
 {collapsible && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setIsExpanded(!isExpanded)}
 >
 {isExpanded ?"Ocultar" :"Mostrar"}
 </Button>
 )}
 </div>
 </CardHeader>
 {isExpanded && (
 <CardContent className="pt-0">
 <ScrollArea className="max-h-[400px]">
 <div className="space-y-4">
 {renderAlertSection(
 overdue,
"Atrasados",
 AlertCircle,
'overdue',
"text-destructive"
 )}
 {renderAlertSection(
 critical,
"Críticos (≤3 dias)",
 AlertTriangle,
'critical',
"text-destructive"
 )}
 {renderAlertSection(
 warning,
"Atenção (≤7 dias)",
 Clock,
'warning',
"text-[hsl(var(--warning))]"
 )}
 {renderAlertSection(
 approaching,
"Próximos (≤14 dias)",
 Clock,
'approaching',
"text-muted-foreground"
 )}
 </div>
 </ScrollArea>
 </CardContent>
 )}
 </Card>
 );
}
