import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelinePhoto } from "@/types/weeklyReport";
import { PhaseType, phaseConfig } from "./types";

interface PhaseImageProps {
  photo?: TimelinePhoto;
  phase: PhaseType;
  onClick?: () => void;
  showCompareHint?: boolean;
}

export function PhaseImage({
  photo,
  phase,
  onClick,
  showCompareHint,
}: PhaseImageProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;

  if (!photo) {
    return (
      <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-2">
        <Icon className="w-8 h-8 text-muted-foreground/30" />
        <span className="text-caption text-muted-foreground/50">
          {config.label}
        </span>
        <span className="text-tiny text-muted-foreground/30">Em breve</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="relative w-full aspect-[4/3] rounded-lg overflow-hidden group"
    >
      <img
        src={photo.url}
        alt={photo.caption}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div
        className={cn(
          "absolute top-3 left-3 px-2.5 py-1 rounded-full text-tiny font-medium flex items-center gap-1.5",
          config.color,
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </div>
      {showCompareHint && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 text-foreground rounded-full text-tiny font-medium flex items-center gap-1.5">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Comparar
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-caption text-white font-medium line-clamp-2">
          {photo.caption}
        </p>
        <p className="text-tiny text-white/70 mt-0.5">{photo.date}</p>
      </div>
    </button>
  );
}
