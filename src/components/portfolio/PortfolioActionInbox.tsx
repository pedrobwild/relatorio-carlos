import { AlertTriangle, FileSignature, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Action Inbox — surface urgent items that need attention.
 * Placeholder: renders mock alerts until wired to real data.
 */
export function PortfolioActionInbox() {
  const mockAlerts = [
    {
      id: '1',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      label: 'Obras com Health Score crítico',
      count: 0,
      accent: 'destructive' as const,
    },
    {
      id: '2',
      icon: <FileSignature className="h-4 w-4 text-[hsl(var(--warning))]" />,
      label: 'Assinaturas pendentes',
      count: 0,
      accent: 'warning' as const,
    },
    {
      id: '3',
      icon: <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />,
      label: 'Obras sem atualização há 7+ dias',
      count: 0,
      accent: 'warning' as const,
    },
  ];

  const hasAlerts = mockAlerts.some(a => a.count > 0);

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ações Requeridas
        </h3>
        {hasAlerts && (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1">
            Ver todas <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="divide-y divide-border/30">
        {mockAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
          >
            <div className="shrink-0">{alert.icon}</div>
            <span className="text-sm text-foreground/80 flex-1">{alert.label}</span>
            <span className="text-sm font-bold tabular-nums text-muted-foreground">
              {alert.count}
            </span>
          </div>
        ))}

        {!hasAlerts && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma ação urgente no momento
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
