import { useMemo } from 'react';
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2, ListChecks, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { NonConformity, NcStatus, NcSeverity } from '@/hooks/useNonConformities';

export type NcFilter =
  | { type: 'overdue' }
  | { type: 'severity'; value: NcSeverity[] }
  | { type: 'status'; value: NcStatus }
  | { type: 'open' }
  | { type: 'category'; value: string }
  | null;

interface Props {
  nonConformities: NonConformity[];
  activeFilter: NcFilter;
  onFilterChange: (filter: NcFilter) => void;
}

export function NcSummaryCards({ nonConformities, activeFilter, onFilterChange }: Props) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const stats = useMemo(() => {
    const open = nonConformities.filter(nc => nc.status !== 'closed');
    const overdue = open.filter(nc => nc.deadline && nc.deadline < today);
    const criticalHigh = open.filter(nc => nc.severity === 'critical' || nc.severity === 'high');
    const pendingApproval = nonConformities.filter(nc => nc.status === 'pending_approval');

    // Category breakdown for open NCs
    const categoryCounts: Record<string, number> = {};
    open.forEach(nc => {
      const cat = (nc as any).category as string | undefined;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const topCategoryName = topCategories.length > 0 ? topCategories[0][0] : null;

    return {
      overdue: overdue.length,
      criticalHigh: criticalHigh.length,
      pendingApproval: pendingApproval.length,
      totalOpen: open.length,
      topCategoryName,
      topCategories,
    };
  }, [nonConformities, today]);

  const toggle = (filter: NcFilter) => {
    // If same filter is active, clear it
    if (activeFilter && filter && JSON.stringify(activeFilter) === JSON.stringify(filter)) {
      onFilterChange(null);
    } else {
      onFilterChange(filter);
    }
  };

  const cards = [
    {
      label: 'Vencidas',
      value: stats.overdue,
      icon: Clock,
      filter: { type: 'overdue' } as NcFilter,
      danger: stats.overdue > 0,
    },
    {
      label: 'Críticas/Altas',
      value: stats.criticalHigh,
      icon: ShieldAlert,
      filter: { type: 'severity', value: ['critical', 'high'] as NcSeverity[] } as NcFilter,
      danger: stats.criticalHigh > 0,
    },
    {
      label: 'Aguardando Aprovação',
      value: stats.pendingApproval,
      icon: CheckCircle2,
      filter: { type: 'status', value: 'pending_approval' as NcStatus } as NcFilter,
      danger: false,
    },
    {
      label: 'Total em aberto',
      value: stats.totalOpen,
      icon: ListChecks,
      filter: { type: 'open' } as NcFilter,
      danger: false,
    },
    ...(stats.topCategoryName ? [{
      label: stats.topCategoryName,
      value: stats.topCategories[0][1],
      icon: Tag,
      filter: { type: 'category', value: stats.topCategoryName } as NcFilter,
      danger: false,
      subtitle: stats.topCategories.length > 1
        ? stats.topCategories.slice(1).map(([name, count]) => `${name}: ${count}`).join(' · ')
        : undefined,
    }] : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const isActive = activeFilter && JSON.stringify(activeFilter) === JSON.stringify(card.filter);
        const Icon = card.icon;
        const subtitle = 'subtitle' in card ? (card as any).subtitle as string | undefined : undefined;
        return (
          <Card
            key={card.label}
            className={`cursor-pointer transition-all active:scale-[0.97] min-h-[44px] ${
              isActive
                ? 'ring-2 ring-primary border-primary'
                : card.danger
                  ? 'border-destructive/40 bg-destructive/5'
                  : ''
            }`}
            onClick={() => toggle(card.filter)}
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                card.danger ? 'bg-destructive/10' : 'bg-muted'
              }`}>
                <Icon className={`h-5 w-5 ${card.danger ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-bold leading-none ${card.danger ? 'text-destructive' : ''}`}>
                  {card.value}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
