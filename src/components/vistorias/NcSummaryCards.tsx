import { useMemo } from "react";
import { Clock, ShieldAlert, CheckCircle2, ListChecks, Tag, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type {
  NonConformity,
  NcStatus,
  NcSeverity,
} from "@/hooks/useNonConformities";
import { formatBRL } from "./ncConstants";

export type NcFilter =
  | { type: "overdue" }
  | { type: "severity"; value: NcSeverity[] }
  | { type: "status"; value: NcStatus }
  | { type: "open" }
  | { type: "category"; value: string }
  | null;

interface Props {
  nonConformities: NonConformity[];
  activeFilter: NcFilter;
  onFilterChange: (filter: NcFilter) => void;
}

export function NcSummaryCards({
  nonConformities,
  activeFilter,
  onFilterChange,
}: Props) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const stats = useMemo(() => {
    const open = nonConformities.filter((nc) => nc.status !== "closed");
    const closed = nonConformities.filter((nc) => nc.status === "closed");
    const overdue = open.filter((nc) => nc.deadline && nc.deadline < today);
    const criticalHigh = open.filter(
      (nc) => nc.severity === "critical" || nc.severity === "high",
    );
    const pendingApproval = nonConformities.filter(
      (nc) => nc.status === "pending_approval",
    );

    // Category breakdown for open NCs
    const categoryCounts: Record<string, number> = {};
    open.forEach((nc) => {
      const cat = nc.category;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const topCategoryName =
      topCategories.length > 0 ? topCategories[0][0] : null;

    // Financial impact
    const openEstimatedTotal = open.reduce((sum, nc) => {
      return sum + (nc.estimated_cost ?? 0);
    }, 0);
    const closedActualTotal = closed.reduce((sum, nc) => {
      return sum + (nc.actual_cost ?? 0);
    }, 0);

    return {
      overdue: overdue.length,
      criticalHigh: criticalHigh.length,
      pendingApproval: pendingApproval.length,
      totalOpen: open.length,
      topCategoryName,
      topCategories,
      openEstimatedTotal,
      closedActualTotal,
    };
  }, [nonConformities, today]);

  const toggle = (filter: NcFilter) => {
    if (
      activeFilter &&
      filter &&
      JSON.stringify(activeFilter) === JSON.stringify(filter)
    ) {
      onFilterChange(null);
    } else {
      onFilterChange(filter);
    }
  };

  const cards = [
    {
      label: "Vencidas",
      value: stats.overdue,
      icon: Clock,
      filter: { type: "overdue" } as NcFilter,
      danger: stats.overdue > 0,
    },
    {
      label: "Críticas/Altas",
      value: stats.criticalHigh,
      icon: ShieldAlert,
      filter: {
        type: "severity",
        value: ["critical", "high"] as NcSeverity[],
      } as NcFilter,
      danger: stats.criticalHigh > 0,
    },
    {
      label: "Aguardando Aprovação",
      value: stats.pendingApproval,
      icon: CheckCircle2,
      filter: {
        type: "status",
        value: "pending_approval" as NcStatus,
      } as NcFilter,
      danger: false,
    },
    {
      label: "Total em aberto",
      value: stats.totalOpen,
      icon: ListChecks,
      filter: { type: "open" } as NcFilter,
      danger: false,
    },
    ...(stats.topCategoryName
      ? [
          {
            label: stats.topCategoryName,
            value: stats.topCategories[0][1],
            icon: Tag,
            filter: {
              type: "category",
              value: stats.topCategoryName,
            } as NcFilter,
            danger: false,
            subtitle:
              stats.topCategories.length > 1
                ? stats.topCategories
                    .slice(1)
                    .map(([name, count]) => `${name}: ${count}`)
                    .join(" · ")
                : undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const isActive =
            activeFilter &&
            JSON.stringify(activeFilter) === JSON.stringify(card.filter);
          const Icon = card.icon;
          const subtitle =
            "subtitle" in card
              ? (card as { subtitle?: string }).subtitle
              : undefined;
          return (
            <Card
              key={card.label}
              className={`cursor-pointer transition-all active:scale-[0.97] min-h-[44px] ${
                isActive
                  ? "ring-2 ring-primary border-primary"
                  : card.danger
                    ? "border-destructive/40 bg-destructive/5"
                    : ""
              }`}
              onClick={() => toggle(card.filter)}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    card.danger ? "bg-destructive/10" : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${card.danger ? "text-destructive" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xl sm:text-2xl font-bold leading-none ${card.danger ? "text-destructive" : ""}`}
                  >
                    {card.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    {card.label}
                  </p>
                  {subtitle && (
                    <p className="text-[9px] text-muted-foreground/70 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Financial impact card */}
      {(stats.openEstimatedTotal > 0 || stats.closedActualTotal > 0) && (
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-muted">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-4 min-w-0">
              <div>
                <p className="text-lg sm:text-xl font-bold leading-none">
                  {formatBRL(stats.openEstimatedTotal)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  Estimado (abertas)
                </p>
              </div>
              {stats.closedActualTotal > 0 && (
                <div>
                  <p className="text-lg sm:text-xl font-bold leading-none text-muted-foreground">
                    {formatBRL(stats.closedActualTotal)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    Real (encerradas)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
