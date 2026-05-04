import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoomProgress } from "@/types/weeklyReport";
import { PhaseType, phaseConfig } from "./types";
import { PhaseImage } from "./PhaseImage";

const statusConfig = {
  concluído: { label: "Concluído", color: "bg-emerald-500 text-white" },
  "em andamento": { label: "Em andamento", color: "bg-amber-500 text-white" },
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
};

function PhaseSelector({
  phases,
  activePhase,
  onSelect,
  room,
}: {
  phases: PhaseType[];
  activePhase: PhaseType;
  onSelect: (p: PhaseType) => void;
  room: RoomProgress;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      {phases.map((phase) => {
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const hasPhoto = room[phase];
        const isActive = activePhase === phase;
        return (
          <button
            key={phase}
            onClick={() => onSelect(phase)}
            disabled={!hasPhoto}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-tiny font-medium transition-all",
              isActive
                ? "bg-card shadow-sm text-foreground"
                : hasPhoto
                  ? "text-muted-foreground hover:bg-card/50"
                  : "text-muted-foreground/40 cursor-not-allowed",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface MobileRoomCardProps {
  room: RoomProgress;
  onCompare: () => void;
}

export function MobileRoomCard({ room, onCompare }: MobileRoomCardProps) {
  const phases: PhaseType[] = room.render3D
    ? ["render3D", "before", "during", "after"]
    : ["before", "during", "after"];

  const defaultPhase =
    room.status === "concluído" && room.after
      ? "after"
      : room.status === "em andamento" && room.during
        ? "during"
        : room.render3D
          ? "render3D"
          : "before";

  const [activePhase, setActivePhase] = useState<PhaseType>(defaultPhase);

  const hasComparison = room.render3D && room.after;
  const showCompareHint =
    hasComparison && (activePhase === "render3D" || activePhase === "after");
  const config = statusConfig[room.status];

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h4 className="text-body font-semibold">{room.name}</h4>
        <Badge className={cn("text-tiny", config.color)}>{config.label}</Badge>
      </div>
      <div className="p-2 border-b border-border">
        <PhaseSelector
          phases={phases}
          activePhase={activePhase}
          onSelect={setActivePhase}
          room={room}
        />
      </div>
      <div className="p-3">
        <PhaseImage
          photo={room[activePhase]}
          phase={activePhase}
          onClick={showCompareHint ? onCompare : undefined}
          showCompareHint={showCompareHint}
        />
      </div>
      {hasComparison && (
        <div className="px-3 pb-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onCompare}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Comparar 3D vs Resultado
          </Button>
        </div>
      )}
    </div>
  );
}
