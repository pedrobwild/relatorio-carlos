import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, type EventRow } from "./types";
import {
  FORMALIZATION_EVENT_TYPE_LABELS,
  type FormalizationEventType,
} from "@/types/formalization";

interface EventHistoryCardProps {
  events: EventRow[];
}

export function EventHistoryCard({ events }: EventHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de Eventos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum evento registrado.
          </p>
        ) : (
          <div className="space-y-4">
            {events
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 pb-4 border-b last:border-0"
                >
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {
                        FORMALIZATION_EVENT_TYPE_LABELS[
                          event.event_type as FormalizationEventType
                        ]
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(event.created_at)}
                    </p>
                    {event.event_type === "signed_by_party" && event.meta && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {(event.meta as any).email && (
                          <p>E-mail: {String((event.meta as any).email)}</p>
                        )}
                        {(event.meta as any).ip_address && (
                          <p>IP: {String((event.meta as any).ip_address)}</p>
                        )}
                        {(event.meta as any).signature_hash && (
                          <p className="font-mono text-[10px] mt-1 break-all">
                            Hash: {String((event.meta as any).signature_hash)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
