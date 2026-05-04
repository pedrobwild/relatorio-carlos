import { useState, useMemo } from "react";
import { Building2, Search, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/searchNormalize";
import type { ProjectWithCustomer } from "@/infra/repositories";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunhos",
  active: "Ativas",
  paused: "Pausadas",
  completed: "Concluídas",
  cancelled: "Canceladas",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-600 border-slate-400/25",
  active: "bg-primary/15 text-primary border-primary/25",
  paused:
    "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25",
  completed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface ProjectSwitcherSheetProps {
  currentProjectName: string;
  unitName: string;
  clientName?: string;
  otherProjects: ProjectWithCustomer[];
  onProjectSwitch: (id: string) => void;
}

export function ProjectSwitcherSheet({
  currentProjectName,
  unitName,
  clientName,
  otherProjects,
  onProjectSwitch,
}: ProjectSwitcherSheetProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return otherProjects;
    return otherProjects.filter((p) =>
      matchesSearch(searchQuery, [p.name, p.unit_name, p.customer_name]),
    );
  }, [otherProjects, searchQuery]);

  const groupedProjects = useMemo(() => {
    const groups: Record<string, ProjectWithCustomer[]> = {};
    filteredProjects.forEach((p) => {
      const status = p.status ?? "active";
      (groups[status] ??= []).push(p);
    });
    return groups;
  }, [filteredProjects]);

  if (otherProjects.length === 0) {
    return (
      <div className="min-w-0">
        <h1 className="text-[15px] font-bold leading-tight text-foreground truncate">
          {currentProjectName} – {unitName}
        </h1>
        {clientName && (
          <p className="text-caption mt-0.5">Cliente: {clientName}</p>
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-lg px-2 py-1.5 -ml-2 transition-colors group min-w-0 w-full">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-tight text-foreground group-hover:text-primary transition-colors truncate">
              {currentProjectName} – {unitName}
            </h1>
            {clientName && (
              <p className="text-caption mt-0.5">Cliente: {clientName}</p>
            )}
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pt-7 pb-safe max-h-[80dvh] flex flex-col"
      >
        <SheetHeader className="pb-2 shrink-0 text-left">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Trocar de Obra
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        {otherProjects.length > 3 && (
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar obra..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        )}

        {/* Project list */}
        <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-4">
          {Object.entries(groupedProjects).map(([status, projects]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5",
                    STATUS_BADGE_STYLES[status],
                  )}
                >
                  {STATUS_LABELS[status] ?? status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {projects.length}
                </span>
              </div>
              <div className="space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setOpen(false);
                      setSearchQuery("");
                      onProjectSwitch(project.id);
                    }}
                    className="flex flex-col items-start gap-0.5 w-full px-3 py-3 rounded-xl text-left transition-colors min-h-[48px] hover:bg-muted/60 active:scale-[0.98]"
                  >
                    <span className="font-medium text-sm text-foreground">
                      {project.name}
                      {project.unit_name && ` – ${project.unit_name}`}
                    </span>
                    {project.customer_name && (
                      <span className="text-xs text-muted-foreground">
                        Cliente: {project.customer_name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma obra encontrada
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
