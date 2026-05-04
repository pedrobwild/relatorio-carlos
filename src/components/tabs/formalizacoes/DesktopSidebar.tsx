import { Clock, CheckCircle2, FileText, FileCheck } from'lucide-react';
import { Card, CardContent } from'@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { FORMALIZATION_TYPE_LABELS } from'@/types/formalization';

interface SidebarProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
 typeFilter: string;
 setTypeFilter: (v: string) => void;
 pendingCount: number;
 signedCount: number;
 totalCount: number;
}

export function DesktopSidebar({
 activeTab, setActiveTab,
 typeFilter, setTypeFilter,
 pendingCount, signedCount, totalCount,
}: SidebarProps) {
 const tabs = [
 { id:'pendentes', label:'Aguardando ciência', icon: Clock, count: pendingCount, color:'amber' },
 { id:'finalizadas', label:'Finalizadas', icon: CheckCircle2, count: signedCount, color:'green' },
 { id:'todas', label:'Ver todas', icon: FileText, count: totalCount, color: null },
 ];

 return (
 <div className="space-y-4">
 <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
 <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
 <CardContent className="p-4 relative">
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
 <FileCheck className="h-5 w-5 text-primary" />
 </div>
 <p className="font-medium text-sm text-foreground mb-1">Proteção para ambas as partes</p>
 <p className="text-xs text-muted-foreground">
 Todas as combinações importantes ficam registradas com ciência formal.
 </p>
 </CardContent>
 </Card>

 <div className="space-y-2">
 {tabs.map(({ id, label, icon: Icon, count, color }) => {
 const isActive = activeTab === id;
 const colorClasses = color
 ? isActive
 ?`border-${color}-500/50 bg-${color}-50/50 }-950/20`
 :`border-border hover:border-${color}-500/30`
 : isActive
 ?'border-primary/50 bg-primary/5'
 :'border-border hover:border-primary/30';
 const textColor = color ?`text-${color}-600` :'text-muted-foreground';

 return (
 <button
 key={id}
 onClick={() => setActiveTab(id)}
 className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${colorClasses}`}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Icon className={`h-4 w-4 ${textColor}`} />
 <span className="text-sm font-medium">{label}</span>
 </div>
 <span className={`text-xl font-bold ${textColor}`}>{count}</span>
 </div>
 </button>
 );
 })}
 </div>

 <div className="p-3 rounded-lg border border-border bg-card">
 <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Filtrar por tipo</p>
 <Select value={typeFilter} onValueChange={setTypeFilter}>
 <SelectTrigger className="w-full h-9" aria-label="Filtrar por tipo">
 <SelectValue placeholder="Todos os tipos" />
 </SelectTrigger>
 <SelectContent className="bg-background border shadow-lg">
 <SelectItem value="all">Todos os tipos</SelectItem>
 {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
 <SelectItem key={value} value={value}>{label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 );
}
