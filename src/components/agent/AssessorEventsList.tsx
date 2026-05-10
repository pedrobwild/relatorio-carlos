/**
 * Lista de eventos passados do BWild Assessor para um projeto.
 */

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BwildAgentEvent } from "@/infra/repositories/agentMemory.repository";
import { EVENT_TYPE_LABEL, ROUTED_AGENT_LABEL, SOURCE_LABEL } from "./labels";

interface AssessorEventsListProps {
  isLoading: boolean;
  events: BwildAgentEvent[];
  highlightedEventId?: string | null;
}

export function AssessorEventsList({
  isLoading,
  events,
  highlightedEventId = null,
}: AssessorEventsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma consulta registrada para esta obra ainda.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li
          key={event.id}
          className={
            "py-3 " +
            (event.id === highlightedEventId
              ? "bg-primary/5 -mx-2 px-2 rounded"
              : "")
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline">
              {EVENT_TYPE_LABEL[event.event_type]}
            </Badge>
            {event.routed_agent && (
              <Badge variant="secondary">
                {ROUTED_AGENT_LABEL[event.routed_agent]}
              </Badge>
            )}
            {event.source && (
              <span className="text-xs text-muted-foreground">
                {SOURCE_LABEL[event.source]}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 line-clamp-2">
            {event.content}
          </p>
          {event.status !== "success" && (
            <p className="text-xs text-destructive mt-1">
              {event.status}: {event.error_message ?? "Erro desconhecido"}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
