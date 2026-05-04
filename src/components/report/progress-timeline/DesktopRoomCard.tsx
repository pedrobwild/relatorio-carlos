import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoomProgress } from "@/types/weeklyReport";
import { PhaseType, phaseConfig } from "./types";

const statusConfig = {
  concluído: {
    label: "Concluído",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  "em andamento": {
    label: "Em andamento",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  pendente: {
    label: "Pendente",
    color: "bg-muted text-muted-foreground border-border",
  },
};

function DesktopPhaseGrid({
  room,
  onCompare,
}: {
  room: RoomProgress;
  onCompare: () => void;
}) {
  const phases: PhaseType[] = room.render3D
    ? ["render3D", "before", "during", "after"]
    : ["before", "during", "after"];

  const hasComparison = room.render3D && room.after;

  return (
    <div
      className={cn(
        "grid gap-2",
        room.render3D ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {phases.map((phase) => {
        const photo = room[phase];
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const isClickable =
          (phase === "render3D" || phase === "after") && hasComparison;

        if (!photo) {
          return (
            <div
              key={phase}
              className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1"
            >
              <Icon className="w-4 h-4 text-muted-foreground/30" />
              <span className="text-tiny text-muted-foreground/30">
                Em breve
              </span>
            </div>
          );
        }

        return (
          <button
            key={phase}
            onClick={isClickable ? onCompare : undefined}
            className={cn(
              "relative aspect-[4/3] rounded-lg overflow-hidden group",
              isClickable && "cursor-pointer",
            )}
          >
            <img
              src={photo.url}
              alt={photo.caption}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div
              className={cn(
                "absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1",
                config.color,
              )}
            >
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
            <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white line-clamp-2">
              {photo.caption}
            </p>
          </button>
        );
      })}
    </div>
  );
}

interface DesktopRoomCardProps {
  room: RoomProgress;
  onCompare: () => void;
}

export function DesktopRoomCard({ room, onCompare }: DesktopRoomCardProps) {
  const config = statusConfig[room.status];
  const hasComparison = room.render3D && room.after;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <h4 className="text-body font-semibold truncate">{room.name}</h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasComparison && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-tiny gap-1 px-2"
              onClick={onCompare}
            >
              <ArrowLeftRight className="w-3 h-3" />
              3D vs Real
            </Button>
          )}
          <Badge
            variant="outline"
            className={cn("text-tiny whitespace-nowrap", config.color)}
          >
            {config.label}
          </Badge>
        </div>
      </div>
      <div className="p-2">
        <DesktopPhaseGrid room={room} onCompare={onCompare} />
      </div>
    </div>
  );
}
