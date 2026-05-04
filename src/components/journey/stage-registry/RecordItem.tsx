import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useDeleteStageRecord,
  type StageRecord,
} from "@/hooks/useStageRecords";

interface RecordItemProps {
  record: StageRecord;
  isAdmin: boolean;
  stageId: string;
}

export function RecordItem({ record, isAdmin, stageId }: RecordItemProps) {
  const deleteRecord = useDeleteStageRecord();
  const [expanded, setExpanded] = useState(false);
  const hasLongContent =
    !!record.description && record.description.length > 120;

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1",
        hasLongContent && "cursor-pointer",
      )}
      onClick={() => hasLongContent && setExpanded((prev) => !prev)}
      role={hasLongContent ? "button" : undefined}
      tabIndex={hasLongContent ? 0 : undefined}
      onKeyDown={
        hasLongContent
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded((prev) => !prev);
              }
            }
          : undefined
      }
      aria-expanded={hasLongContent ? expanded : undefined}
    >
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          record.responsible === "client"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {record.responsible === "client" ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Building2 className="h-3.5 w-3.5" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {record.title}
          </span>
        </div>
        {record.description && (
          <p
            className={cn(
              "text-xs text-muted-foreground whitespace-pre-wrap",
              !expanded && "line-clamp-2",
            )}
          >
            {record.description}
          </p>
        )}
        {hasLongContent && !expanded && (
          <span className="text-xs text-primary font-medium">Ver mais</span>
        )}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {format(parseISO(record.record_date), "dd MMM yyyy", {
              locale: ptBR,
            })}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 capitalize"
          >
            {record.responsible === "client" ? "Cliente" : "Bwild"}
          </Badge>
        </div>
      </div>

      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
          onClick={(e) => {
            e.stopPropagation();
            deleteRecord.mutate({ id: record.id, stageId });
          }}
          disabled={deleteRecord.isPending}
          aria-label={`Remover registro: ${record.title}`}
        >
          {deleteRecord.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </li>
  );
}
