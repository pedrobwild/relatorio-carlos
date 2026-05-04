import { useState } from "react";
import {
  CalendarIcon,
  Plus,
  Calendar as CalendarIconSolid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { journeyCopy } from "@/constants/journeyCopy";
import { useStageDates } from "@/hooks/useStageDates";
import { StageDateRow } from "./stage-dates/StageDateRow";
import { CreateStageDateForm } from "./stage-dates/CreateStageDateForm";
import { MiniTimeline } from "./stage-dates/MiniTimeline";

// ─── Loading Skeleton ───

function DatesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando datas">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 ml-auto rounded-full" />
          </div>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───

function EmptyDatesState({ isStaff }: { isStaff: boolean }) {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="mx-auto w-10 h-10 rounded-full bg-accent flex items-center justify-center">
        <CalendarIconSolid className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        {journeyCopy.dates.panel.empty_title}
      </p>
      <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
        {isStaff
          ? journeyCopy.dates.panel.empty_body_admin
          : journeyCopy.dates.panel.empty_body_client}
      </p>
    </div>
  );
}

// ─── Main Panel ───

interface StageDatesPanelProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
  stageName: string;
}

export function StageDatesPanel({
  stageId: _stageId,
  projectId,
  isAdmin,
  stageName,
}: StageDatesPanelProps) {
  const [showCreate, setShowCreate] = useState(false);

  const stageKey = stageName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
  const { data: granularDates, isLoading } = useStageDates(projectId, stageKey);

  const hasGranularDates = (granularDates?.length ?? 0) > 0;

  if (!isAdmin && !hasGranularDates && !isLoading) return null;

  return (
    <section
      className="space-y-4 p-4 md:p-5 bg-card rounded-xl border border-border/50 shadow-[var(--shadow-sm)]"
      aria-label="Prazo de entrega da etapa"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent">
            <CalendarIcon className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <h4 className="text-sm font-bold text-foreground tracking-tight">
            {journeyCopy.dates.panel.title}
          </h4>
        </div>
        {isAdmin && !showCreate && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 text-xs gap-1.5 min-w-[44px]"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />{" "}
            {journeyCopy.dates.panel.newDate}
          </Button>
        )}
      </div>

      {/* Mini Timeline */}
      {hasGranularDates &&
        granularDates!.filter(
          (sd) => sd.bwild_confirmed_at || sd.customer_proposed_at,
        ).length >= 2 && <MiniTimeline dates={granularDates!} />}

      {/* Granular date cards */}
      {isLoading ? (
        <DatesSkeleton />
      ) : hasGranularDates ? (
        <div className="space-y-3">
          {granularDates!.map((sd) => (
            <StageDateRow
              key={sd.id}
              sd={sd}
              isStaff={isAdmin}
              projectId={projectId}
            />
          ))}
        </div>
      ) : (
        <EmptyDatesState isStaff={isAdmin} />
      )}

      {/* Create form */}
      {showCreate && (
        <CreateStageDateForm
          projectId={projectId}
          stageKey={stageKey}
          existingCount={granularDates?.length ?? 0}
          onClose={() => setShowCreate(false)}
        />
      )}
    </section>
  );
}
