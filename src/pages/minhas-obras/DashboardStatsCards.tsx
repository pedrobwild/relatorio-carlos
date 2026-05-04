import {
  Building2,
  AlertTriangle,
  ClipboardSignature,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/hooks/useClientDashboard";

interface DashboardStatsCardsProps {
  stats: DashboardStats;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: "default" | "warning" | "destructive" | "success";
  subtitle?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "default",
  subtitle,
}: StatCardProps) {
  const accentColors = {
    default: "text-primary bg-primary/10",
    warning: "text-[hsl(var(--warning))] bg-[hsl(var(--warning-light))]",
    destructive: "text-destructive bg-destructive/10",
    success: "text-[hsl(var(--success))] bg-[hsl(var(--success-light))]",
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${accentColors[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-tiny text-muted-foreground leading-tight">
            {label}
          </p>
          <p className="text-lg font-bold leading-tight mt-0.5">{value}</p>
          {subtitle && (
            <p className="text-tiny text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={Building2}
        label="Projetos Ativos"
        value={stats.activeProjects}
        subtitle={
          stats.totalProjects > stats.activeProjects
            ? `${stats.totalProjects} total`
            : undefined
        }
      />
      <StatCard
        icon={TrendingUp}
        label="Progresso Médio"
        value={`${stats.avgProgress}%`}
        accent="success"
      />
      <StatCard
        icon={AlertTriangle}
        label="Pendências"
        value={stats.totalPending}
        accent={stats.totalPending > 0 ? "warning" : "default"}
        subtitle={undefined}
      />
      <StatCard
        icon={ClipboardSignature}
        label="Assinaturas"
        value={stats.unsignedFormalizations}
        accent={stats.unsignedFormalizations > 0 ? "warning" : "default"}
        subtitle={stats.unsignedFormalizations > 0 ? "pendente(s)" : "em dia"}
      />
    </div>
  );
}
