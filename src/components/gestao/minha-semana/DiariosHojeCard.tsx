/**
 * DiariosHojeCard — card compacto (Minha Semana) de cobertura de RDO
 * de hoje. Lista obras ativas do staff com status "preenchido" ou
 * "pendente" e leva direto para o editor do dia.
 *
 * Staff-only por definição da rota que o hospeda.
 */
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ClipboardList, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useDailyLogTodayCoverage } from "@/hooks/useDailyLogTodayCoverage";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 6;

export function DiariosHojeCard() {
  const projectsQ = useProjectsQuery({ status: "active" });
  const projectIds = useMemo(
    () => (projectsQ.data ?? []).map((p) => p.id).filter(Boolean),
    [projectsQ.data],
  );
  const coverage = useDailyLogTodayCoverage(projectIds);

  const projects = projectsQ.data ?? [];
  const byId = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const isLoading = projectsQ.isLoading || coverage.isLoading;

  if (!isLoading && projectIds.length === 0) {
    return null;
  }

  const rows = coverage.rows;
  const pending = rows.filter((r) => !r.hasLog);
  // pendentes primeiro, depois preenchidos
  const ordered = [...pending, ...rows.filter((r) => r.hasLog)].slice(
    0,
    MAX_VISIBLE,
  );
  const overflow = Math.max(0, rows.length - ordered.length);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Diários de hoje</CardTitle>
        </div>
        {!isLoading && coverage.total > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {coverage.filled}/{coverage.total} preenchidos
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma obra ativa hoje.
          </p>
        ) : (
          <ul className="divide-y">
            {ordered.map((r) => {
              const proj = byId.get(r.projectId);
              return (
                <li key={r.projectId}>
                  <Link
                    to={`/gestao/diario/${r.projectId}/${coverage.date}`}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 min-h-[44px]",
                      "hover:bg-muted/40 -mx-2 px-2 rounded-md",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold shrink-0",
                          r.hasLog
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning",
                        )}
                      >
                        {r.hasLog ? <Check className="h-3.5 w-3.5" /> : "!"}
                      </span>
                      <span className="text-sm truncate">
                        {proj?.name ?? "Obra"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[11px]",
                          r.hasLog
                            ? "text-muted-foreground"
                            : "text-warning font-medium",
                        )}
                      >
                        {r.hasLog ? "Preenchido" : "Pendente"}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
            {overflow > 0 && (
              <li className="py-2 text-xs text-muted-foreground text-center">
                +{overflow} obra{overflow === 1 ? "" : "s"} não exibida
                {overflow === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
