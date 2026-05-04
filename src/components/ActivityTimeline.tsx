import { AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useProjectEvents,
  type DomainEvent,
  EVENT_TYPES,
} from "@/hooks/useDomainEvents";
import { getEventConfig, formatRelativeDate } from "./timeline/eventConfig";

interface ActivityTimelineProps {
  projectId?: string;
  orgId?: string;
  maxItems?: number;
  showHeader?: boolean;
  className?: string;
}

const getEventDescription = (event: DomainEvent): string => {
  const payload = event.payload as Record<string, unknown>;

  switch (event.event_type) {
    case EVENT_TYPES.FORMALIZATION_CREATED:
      return payload.title ? `"${payload.title}"` : "Nova formalização";
    case EVENT_TYPES.FORMALIZATION_UPDATED: {
      const fields = payload.fields_updated as string[] | undefined;
      return fields?.length
        ? `Campos: ${fields.join(", ")}`
        : "Conteúdo atualizado";
    }
    case EVENT_TYPES.FORMALIZATION_SENT:
      return payload.title
        ? `"${payload.title}"`
        : "Enviada para coleta de assinaturas";
    case EVENT_TYPES.FORMALIZATION_SIGNED:
      return payload.party_name
        ? `por ${payload.party_name}`
        : "Assinatura registrada";
    case EVENT_TYPES.PAYMENT_RECEIVED:
      return payload.amount
        ? `R$ ${Number(payload.amount).toLocaleString("pt-BR")}`
        : "";
    case EVENT_TYPES.DOCUMENT_UPLOADED:
    case EVENT_TYPES.DOCUMENT_VERSION_UPLOADED:
      return payload.filename ? `"${payload.filename}"` : "";
    case EVENT_TYPES.PROJECT_MEMBER_ADDED:
    case EVENT_TYPES.PROJECT_MEMBER_REMOVED:
      return payload.member_name ? `${payload.member_name}` : "";
    default:
      return payload.title ? String(payload.title) : "";
  }
};

function TimelineItem({
  event,
  isLast,
}: {
  event: DomainEvent;
  isLast: boolean;
}) {
  const config = getEventConfig(event.event_type);
  const Icon = config.icon;
  const description = getEventDescription(event);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {!isLast && (
        <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />
      )}
      <div
        className={`absolute left-0 top-0.5 w-7 h-7 rounded-full ${config.bgColor} flex items-center justify-center`}
      >
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{config.label}</p>
            {description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {description}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatRelativeDate(event.created_at)}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize">
          {event.entity_type.replace(/_/g, " ")}
        </Badge>
      </div>
    </div>
  );
}

function TimelineLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineContent({
  events,
  isLoading,
  error,
}: {
  events: DomainEvent[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <TimelineLoading />;

  if (error) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-8 w-8 text-destructive/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Erro ao carregar atividades.
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
          <Activity className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma atividade registrada.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          As ações do projeto aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px] pr-4">
      <div className="space-y-0">
        {events.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function ActivityTimeline({
  projectId,
  orgId,
  maxItems = 20,
  showHeader = true,
  className = "",
}: ActivityTimelineProps) {
  const { events, isLoading, error } = useProjectEvents(projectId);
  const displayEvents = events.slice(0, maxItems);

  if (showHeader) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Atividade Recente
            {displayEvents.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {displayEvents.length}{" "}
                {displayEvents.length === 1 ? "evento" : "eventos"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineContent
            events={displayEvents}
            isLoading={isLoading}
            error={error}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <TimelineContent
        events={displayEvents}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

// Compact version for sidebars
export function ActivityTimelineCompact({
  projectId,
  maxItems = 5,
}: {
  projectId?: string;
  maxItems?: number;
}) {
  const { events, isLoading } = useProjectEvents(projectId);
  const displayEvents = events.slice(0, maxItems);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (displayEvents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Sem atividade recente
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayEvents.map((event) => {
        const config = getEventConfig(event.event_type);
        const Icon = config.icon;
        return (
          <div key={event.id} className="flex items-center gap-2 text-xs">
            <div
              className={`w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}
            >
              <Icon className={`h-2.5 w-2.5 ${config.color}`} />
            </div>
            <span className="truncate flex-1">{config.label}</span>
            <span className="text-muted-foreground shrink-0">
              {formatRelativeDate(event.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
