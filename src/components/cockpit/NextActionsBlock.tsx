/**
 * NextActionsBlock — bloco "Ação necessária" do cockpit de decisão.
 *
 * Reduz o time-to-action respondendo no topo de MinhasObras / Index a
 * pergunta "o que eu preciso fazer agora?". Mostra no máximo 3 ações
 * ranqueadas (atraso > tácita > pagamento > aprovação) com CTA primário.
 * Estado vazio é "Tudo em dia" — não some, mantém o canal de confiança.
 *
 * Mobile-first: CTAs com altura mínima 44px (área de toque), tipografia
 * legível em 375px. Tokens semânticos apenas (destructive/warning/info).
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import {
  SectionCard,
  StatusBadge,
  EmptyState,
  type StatusTone,
} from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trackAmplitude } from "@/lib/amplitude";
import {
  useNextActions,
  type NextAction,
  type NextActionUrgency,
} from "@/hooks/useNextActions";

interface NextActionsBlockProps {
  projectId?: string;
  className?: string;
}

const TONE_BY_URGENCY: Record<NextActionUrgency, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
};

const URGENCY_LABEL: Record<NextActionUrgency, string> = {
  critical: "Crítico",
  high: "Atenção",
  medium: "Em breve",
};

const OWNER_LABEL = {
  client: "Ação sua",
  bwild: "Ação BWild",
} as const;

export function NextActionsBlock({
  projectId,
  className,
}: NextActionsBlockProps) {
  const { actions, isLoading, isEmpty } = useNextActions(projectId);
  const navigate = useNavigate();
  const trackedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const fingerprint = actions
      .map((a) => `${a.type}:${a.urgency}:${a.owner}`)
      .join("|");
    if (fingerprint === trackedFingerprintRef.current) return;
    trackedFingerprintRef.current = fingerprint;
    trackAmplitude("next_action_displayed", {
      count: actions.length,
      projectId: projectId ?? null,
      types: actions.map((a) => a.type).join(",") || null,
      urgencies: actions.map((a) => a.urgency).join(",") || null,
    });
  }, [actions, isLoading, projectId]);

  const handleCtaClick = (action: NextAction) => {
    trackAmplitude("next_action_clicked", {
      type: action.type,
      urgency: action.urgency,
      owner: action.owner,
      projectId: action.projectId ?? projectId ?? null,
    });
    navigate(action.cta.href);
  };

  return (
    <SectionCard
      title="Ação necessária"
      description="O que precisa da sua atenção agora — máximo 3 itens prioritários."
      className={className}
    >
      {isLoading ? (
        <div className="space-y-3" data-testid="next-actions-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          bare
          size="sm"
          icon={CheckCircle2}
          title="Tudo em dia"
          description="Sem decisões pendentes no momento. Boa hora para revisar a evolução da obra."
        />
      ) : (
        <ul className="space-y-3" role="list">
          {actions.map((action) => (
            <NextActionRow
              key={action.id}
              action={action}
              onCtaClick={handleCtaClick}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

interface NextActionRowProps {
  action: NextAction;
  onCtaClick: (action: NextAction) => void;
}

function NextActionRow({ action, onCtaClick }: NextActionRowProps) {
  const tone = TONE_BY_URGENCY[action.urgency];
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3",
        "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <StatusBadge tone={tone} size="sm">
            {URGENCY_LABEL[action.urgency]}
          </StatusBadge>
          <span className="text-tiny uppercase tracking-wider text-muted-foreground">
            {OWNER_LABEL[action.owner]}
          </span>
        </div>
        <h3 className="text-body font-semibold text-foreground leading-snug truncate">
          {action.title}
        </h3>
        <p className="text-caption text-muted-foreground leading-snug mt-0.5">
          {action.impact}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => onCtaClick(action)}
        className="min-h-[44px] sm:min-h-0 sm:h-9 gap-1.5 shrink-0 self-stretch sm:self-auto"
        aria-label={`${action.cta.label}: ${action.title}`}
      >
        <ListChecks className="h-4 w-4" aria-hidden />
        {action.cta.label}
        <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
      </Button>
    </li>
  );
}
