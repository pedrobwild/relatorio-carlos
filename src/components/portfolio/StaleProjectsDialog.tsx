import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ghost, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

interface StaleProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectWithCustomer[];
  summaries: ProjectSummary[];
}

interface StaleProject {
  id: string;
  name: string;
  customer: string | null;
  engineer: string | null;
  staleDays: number;
}

function getStaleProjects(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
): StaleProject[] {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_STALE = 7 * 24 * 60 * 60 * 1000;
  const result: StaleProject[] = [];

  for (const p of projects) {
    if (p.status !== "active") continue;
    const s = summaryMap.get(p.id);
    const ref = s?.last_activity_at ?? p.created_at;
    const refTime = ref ? new Date(ref).getTime() : 0;
    const isStale = refTime > 0 && now - refTime > MS_STALE;

    if (isStale) {
      const staleDays = Math.floor((now - refTime) / (1000 * 60 * 60 * 24));

      result.push({
        id: p.id,
        name: p.name,
        customer: p.customer_name ?? null,
        engineer: p.engineer_name ?? null,
        staleDays,
      });
    }
  }

  result.sort((a, b) => (b.staleDays ?? 999) - (a.staleDays ?? 999));
  return result;
}

export function StaleProjectsDialog({
  open,
  onOpenChange,
  projects,
  summaries,
}: StaleProjectsDialogProps) {
  const navigate = useNavigate();
  const staleProjects = useMemo(
    () => getStaleProjects(projects, summaries),
    [projects, summaries],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/10">
              <Ghost className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Obras sem atualização
              </DialogTitle>
              <DialogDescription className="text-xs">
                {staleProjects.length} obra(s) sem atividade registrada há mais
                de 7 dias
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {staleProjects.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Todas as obras estão atualizadas ✓
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30 -mx-2">
              {staleProjects.map((sp) => (
                <li key={sp.id}>
                  <button
                    type="button"
                    className={cn(
                      "group flex items-center gap-3 w-full text-left px-3 py-3 rounded-lg",
                      "hover:bg-muted/30 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/obra/${sp.id}`);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sp.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sp.customer && (
                          <span className="text-xs text-muted-foreground truncate">
                            {sp.customer}
                          </span>
                        )}
                        {sp.engineer && (
                          <span className="text-xs text-muted-foreground/60 truncate">
                            • {sp.engineer}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] font-semibold tabular-nums",
                        (sp.staleDays ?? 8) >= 14
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                      )}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {sp.staleDays ? `${sp.staleDays}d` : "N/A"}
                    </Badge>

                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
