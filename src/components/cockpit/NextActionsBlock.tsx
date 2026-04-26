/**
 * NextActionsBlock — bloco "Ação necessária" do cockpit do cliente.
 *
 * Renderiza no máximo 3 itens ranqueados por `useNextActions`.
 * Estado vazio ("Tudo em dia") permanece visível — não escondemos o
 * bloco para que o cliente saiba que olhamos por ele.
 *
 * Tracking:
 *  - `next_action_displayed` ao montar (com counts por tipo)
 *  - `next_action_clicked` no clique do CTA
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, FileSignature, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard, EmptyState, StatusBadge, type StatusTone } from '@/components/ui-premium';
import { useNextActions, type NextAction, type NextActionType } from '@/hooks/useNextActions';
import { trackAmplitude } from '@/lib/amplitude';
import { cn } from '@/lib/utils';

interface NextActionsBlockProps {
  /** Quando informado, escopo per-project; ausente = agregado do usuário. */
  projectId?: string;
  className?: string;
  /** Origem para analytics (ex: "minhas_obras", "project_portal"). */
  surface?: string;
}

const ICON_BY_TYPE: Record<NextActionType, typeof AlertTriangle> = {
  overdue: AlertTriangle,
  tacit: Clock,
  payment: Wallet,
  approval: FileSignature,
};

const TONE_BY_TYPE: Record<NextActionType, StatusTone> = {
  overdue: 'danger',
  tacit: 'warning',
  payment: 'info',
  approval: 'warning',
};

const LABEL_BY_TYPE: Record<NextActionType, string> = {
  overdue: 'Atrasado',
  tacit: 'Tácita iminente',
  payment: 'Vencimento próximo',
  approval: 'Decisão pendente',
};

export function NextActionsBlock({ projectId, className, surface }: NextActionsBlockProps) {
  const navigate = useNavigate();
  const { actions, isLoading } = useNextActions(projectId);

  useEffect(() => {
    if (isLoading) return;
    trackAmplitude('next_action_displayed', {
      surface: surface ?? (projectId ? 'project_portal' : 'minhas_obras'),
      project_id: projectId ?? null,
      count: actions.length,
      has_overdue: actions.some((a) => a.type === 'overdue'),
      has_tacit: actions.some((a) => a.type === 'tacit'),
    });
  }, [actions, isLoading, projectId, surface]);

  const handleClick = (action: NextAction) => {
    trackAmplitude('next_action_clicked', {
      surface: surface ?? (projectId ? 'project_portal' : 'minhas_obras'),
      project_id: action.projectId ?? projectId ?? null,
      type: action.type,
      urgency: action.urgency,
      owner: action.owner,
    });
    navigate(action.cta.href);
  };

  return (
    <SectionCard
      className={className}
      title="Ação necessária"
      description="O que precisa da sua atenção agora — ranqueado por urgência."
    >
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo em dia"
          description="Nada exige sua decisão agora. Vamos te avisar assim que houver."
          size="sm"
          bare
        />
      ) : (
        <ul className="divide-y divide-border-subtle -my-2">
          {actions.map((action) => (
            <li key={action.id} className="py-2.5">
              <ActionRow action={action} onClick={() => handleClick(action)} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ActionRow({ action, onClick }: { action: NextAction; onClick: () => void }) {
  const Icon = ICON_BY_TYPE[action.type];
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-full shrink-0 mt-0.5',
          action.type === 'overdue' && 'bg-destructive/10 text-destructive',
          action.type === 'tacit' && 'bg-warning/12 text-warning',
          action.type === 'payment' && 'bg-info/10 text-info',
          action.type === 'approval' && 'bg-warning/12 text-warning',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <StatusBadge tone={TONE_BY_TYPE[action.type]} size="sm">
            {LABEL_BY_TYPE[action.type]}
          </StatusBadge>
          {action.projectName && (
            <span className="text-tiny text-muted-foreground truncate">{action.projectName}</span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground leading-snug">{action.title}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{action.impact}</p>
      </div>
      <Button
        size="sm"
        onClick={onClick}
        className="shrink-0 min-h-[44px] gap-1.5 self-center"
        aria-label={`${action.cta.label}: ${action.title}`}
      >
        <span className="hidden sm:inline">{action.cta.label}</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
