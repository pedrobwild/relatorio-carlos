export const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  paused: "bg-warning/10 text-[hsl(var(--warning))] border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  completed: "Concluída",
  paused: "Pausada",
  cancelled: "Cancelada",
};
