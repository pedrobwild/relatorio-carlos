import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { journeyCopy } from "@/constants/journeyCopy";
import type { StageDateEvent } from "@/hooks/useStageDates";

const actionLabels = journeyCopy.dates.history.actions;
const roleLabels = journeyCopy.dates.history.roles;

interface DateHistoryDrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  events: StageDateEvent[] | undefined;
  isLoading: boolean;
}

export function DateHistoryDrawer({
  open,
  onOpenChange,
  title,
  events,
  isLoading,
}: DateHistoryDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden />
            {journeyCopy.dates.history.title}
          </DrawerTitle>
          <DrawerDescription className="text-xs">{title}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          {isLoading ? (
            <div
              className="space-y-3 py-4"
              aria-busy="true"
              aria-label="Carregando histórico"
            >
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <ol
              className="relative pl-5 space-y-0 list-none"
              aria-label="Histórico de alterações"
            >
              <div
                className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
                aria-hidden
              />
              {events.map((ev, idx) => {
                const isFirst = idx === 0;
                const roleLabel = roleLabels[ev.actor_role] || ev.actor_role;
                const actionLabel = actionLabels[ev.action] || ev.action;

                return (
                  <li key={ev.id} className="relative flex gap-3 py-3">
                    <div
                      className={cn(
                        "absolute -left-5 top-[18px] h-3.5 w-3.5 rounded-full border-2 border-background shrink-0",
                        isFirst ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-5 px-2 font-medium",
                            ev.actor_role === "customer"
                              ? "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]"
                              : "bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]",
                          )}
                        >
                          {roleLabel}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {actionLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                        {format(
                          parseISO(ev.created_at),
                          "dd 'de' MMM, yyyy · HH:mm",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="text-center py-8 space-y-2">
              <History
                className="h-8 w-8 text-muted-foreground/30 mx-auto"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                {journeyCopy.dates.history.empty}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {journeyCopy.dates.history.emptySubtitle}
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
