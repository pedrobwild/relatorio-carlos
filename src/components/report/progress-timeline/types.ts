import { Box, Camera, Hammer, Check } from "lucide-react";

export type PhaseType = "render3D" | "before" | "during" | "after";

export const phaseConfig: Record<
  PhaseType,
  {
    icon: typeof Box;
    color: string;
    borderColor: string;
    ringColor: string;
    label: string;
  }
> = {
  render3D: {
    icon: Box,
    color: "bg-blue-500/10 text-blue-600",
    borderColor: "border-blue-500/50",
    ringColor: "ring-blue-500/50",
    label: "Projeto 3D",
  },
  before: {
    icon: Camera,
    color: "bg-muted text-muted-foreground",
    borderColor: "border-muted-foreground/30",
    ringColor: "ring-muted-foreground/50",
    label: "Antes",
  },
  during: {
    icon: Hammer,
    color: "bg-amber-500/10 text-amber-600",
    borderColor: "border-amber-500/50",
    ringColor: "ring-amber-500/50",
    label: "Durante",
  },
  after: {
    icon: Check,
    color: "bg-emerald-500/10 text-emerald-600",
    borderColor: "border-emerald-500/50",
    ringColor: "ring-emerald-500/50",
    label: "Resultado",
  },
};
