import { HeartPulse, Ghost, DollarSign, CalendarClock } from'lucide-react';
import { cn } from'@/lib/utils';

interface PortfolioPriorityBarProps {
 activeKey: string | null;
 onSelect: (key: string | null) => void;
}

const priorityButtons = [
 { key:'critical', label:'Críticas', icon: HeartPulse, color:'text-destructive border-destructive/30 bg-destructive/5' },
 { key:'no-update', label:'Sem update 7d+', icon: Ghost, color:'text-amber-600 border-amber-300 bg-amber-50' },
 { key:'cost-risk', label:'Custo em risco', icon: DollarSign, color:'text-destructive border-destructive/30 bg-destructive/5' },
 { key:'delivery-14d', label:'Entrega 14d', icon: CalendarClock, color:'text-blue-600 border-blue-300 bg-blue-50' },
] as const;

export function PortfolioPriorityBar({ activeKey, onSelect }: PortfolioPriorityBarProps) {
 return (
 <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
 {priorityButtons.map((btn) => (
 <button
 key={btn.key}
 type="button"
 onClick={() => onSelect(activeKey === btn.key ? null : btn.key)}
 className={cn(
'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-all',
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
'active:scale-[0.96]',
 activeKey === btn.key
 ? btn.color
 :'border-border/40 bg-card text-muted-foreground hover:border-border/70',
 )}
 >
 <btn.icon className="h-3.5 w-3.5" />
 {btn.label}
 </button>
 ))}
 </div>
 );
}
