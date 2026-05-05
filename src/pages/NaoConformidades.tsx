import { useState, useMemo } from "react";
import { Plus, Search, LayoutList, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import {
  useNonConformities,
  type NonConformity,
} from "@/hooks/useNonConformities";
import { NcManagementPanel } from "@/components/vistorias/NcManagementPanel";
import { NcKanbanView } from "@/components/vistorias/NcKanbanView";
import { NcDetailDialog } from "@/components/vistorias/NcDetailDialog";
import { CreateNcDialog } from "@/components/vistorias/CreateNcDialog";
import { PageSkeleton } from "@/components/ui-premium";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";

export default function NaoConformidades() {
  const { projectId } = useProjectNavigation();
  const { data: nonConformities = [], isLoading } =
    useNonConformities(projectId);
  const { can } = useCan();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedNc, setSelectedNc] = useState<NonConformity | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const _openNcs = useMemo(
    () => nonConformities.filter((nc) => nc.status !== "closed"),
    [nonConformities],
  );

  if (isLoading) {
    return (
      <div className="py-6">
        <PageContainer maxWidth="full">
          <PageSkeleton metrics={false} content="cards" />
        </PageContainer>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Não Conformidades" maxWidth="full" showLogo={false}>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5"
            role="radiogroup"
          >
            {[
              { mode: "list" as const, icon: LayoutList, label: "Lista" },
              { mode: "kanban" as const, icon: Columns3, label: "Kanban" },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 sm:h-8 px-3 sm:px-2.5 rounded-md text-xs font-medium transition-all",
                  viewMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
          </Button>
          {can("ncs:create") && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="gap-2 h-10 min-w-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova NC</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="py-4 md:py-6">
        <PageContainer maxWidth="full">
          <div className="space-y-4">
            <div
              className={`relative w-full sm:w-64 ${showSearch ? "block" : "hidden md:block"}`}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar NC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
                autoFocus={showSearch}
              />
            </div>

            {viewMode === "list" ? (
              <NcManagementPanel
                nonConformities={nonConformities}
                searchQuery={searchQuery}
                onSelect={setSelectedNc}
                onCreateNc={() => setShowCreateDialog(true)}
                canCreate={can("ncs:create")}
              />
            ) : (
              <NcKanbanView
                nonConformities={nonConformities}
                searchQuery={searchQuery}
                onSelect={setSelectedNc}
              />
            )}
          </div>
        </PageContainer>
      </div>

      {selectedNc && (
        <NcDetailDialog
          nc={selectedNc}
          open={!!selectedNc}
          onOpenChange={(open) => !open && setSelectedNc(null)}
        />
      )}

      {showCreateDialog && projectId && (
        <CreateNcDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projectId={projectId}
          onSuccess={() => setShowCreateDialog(false)}
        />
      )}
    </>
  );
}
