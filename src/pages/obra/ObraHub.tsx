import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useUserRole } from '@/hooks/useUserRole';
import { useObraHubStatus } from '@/hooks/useObraHubStatus';
import { getVisibleHubGroups } from '@/config/obraHub';
import { HubGroup } from '@/components/obra/HubGroup';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const ObraHub = () => {
  const { paths, projectId } = useProjectNavigation();
  const { isStaff } = useUserRole();
  const { byId, nextAction, isLoading } = useObraHubStatus(projectId);
  const navigate = useNavigate();

  const groups = useMemo(() => getVisibleHubGroups(isStaff), [isStaff]);

  const handleResolve = () => {
    if (nextAction?.actionUrl) {
      navigate(nextAction.actionUrl);
    } else {
      navigate(paths.pendencias);
    }
  };

  return (
    <div className="px-3 py-4 space-y-5 max-w-2xl mx-auto">
      {/* Próximo passo — only when there's an open pending action */}
      {nextAction && <NextActionCard nextAction={nextAction} onResolve={handleResolve} />}

      {nextAction === null && !isLoading && (
        <div className="rounded-2xl bg-card border border-border/60 px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nenhuma pendência aberta agora.
          </p>
        </div>
      )}

      {isLoading && !nextAction && (
        <Skeleton className="h-24 rounded-2xl" />
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <HubGroup key={group.id} group={group} paths={paths} statusById={byId} />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-2">
        <Link to={paths.relatorio} className="underline-offset-4 hover:underline">
          Ver painel completo da obra
        </Link>
      </p>
    </div>
  );
};

interface NextActionCardProps {
  nextAction: { title: string; description?: string; dueDate?: string };
  onResolve: () => void;
}

function NextActionCard({ nextAction, onResolve }: NextActionCardProps) {
  const dueLabel = useMemo(() => {
    if (!nextAction.dueDate) return null;
    const days = differenceInCalendarDays(parseISO(nextAction.dueDate), new Date());
    if (days < 0) return `Atrasado há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`;
    if (days === 0) return 'Vence hoje';
    if (days === 1) return 'Vence amanhã';
    return `Vence em ${days} dias`;
  }, [nextAction.dueDate]);

  return (
    <section aria-label="Próximo passo">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">
        Próximo passo
      </h2>
      <div className="rounded-2xl bg-card border border-primary/20 shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground leading-snug">
            {nextAction.title}
          </p>
          {dueLabel && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {dueLabel}
            </p>
          )}
        </div>
        <Button onClick={onResolve} className="w-full gap-2" size="sm">
          Resolver agora
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

export default ObraHub;
