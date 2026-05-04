import { useState } from "react";
import { Plus, ClipboardCheck, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageSkeleton } from "@/components/ui-premium";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useInspections, type Inspection } from "@/hooks/useInspections";
import { InspectionsList } from "@/components/vistorias/InspectionsList";
import { CreateInspectionDialog } from "@/components/vistorias/CreateInspectionDialog";
import { DuplicateInspectionDialog } from "@/components/vistorias/DuplicateInspectionDialog";
import { InspectionDetailDialog } from "@/components/vistorias/InspectionDetailDialog";
import { CreateNcDialog } from "@/components/vistorias/CreateNcDialog";
import { CorrectiveActionTemplatesAdmin } from "@/components/vistorias/CorrectiveActionTemplatesAdmin";
import { useNonConformities } from "@/hooks/useNonConformities";
import { useCan } from "@/hooks/useCan";

export default function Vistorias() {
  const { projectId } = useProjectNavigation();
  const { data: inspections = [], isLoading: loadingInspections } =
    useInspections(projectId);
  const { data: nonConformities = [] } = useNonConformities(projectId);
  const { can } = useCan();

  const [tab, setTab] = useState("vistorias");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [createNcContext, setCreateNcContext] = useState<{
    inspectionId?: string;
    inspectionItemId?: string;
    prefillTitle?: string;
  } | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(
    null,
  );

  if (loadingInspections) {
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
      <PageHeader title="Vistorias" maxWidth="full" showLogo={false}>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
          </Button>
          {can("inspections:create") && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="gap-2 h-10 min-w-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Vistoria</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="py-4 md:py-6">
        <PageContainer maxWidth="full">
          {can("admin:manage_system") ? (
            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger
                    value="vistorias"
                    className="gap-1.5 min-h-[44px] flex-1 sm:flex-none"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Vistorias</span>
                    <Badge variant="secondary" className="ml-1">
                      {inspections.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="config"
                    className="gap-1.5 min-h-[44px] flex-1 sm:flex-none"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden xs:inline">Config</span>
                  </TabsTrigger>
                </TabsList>

                <div
                  className={`relative w-full sm:w-64 ${showSearch ? "block" : "hidden md:block"}`}
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                    autoFocus={showSearch}
                  />
                </div>
              </div>

              <TabsContent value="vistorias">
                <InspectionsList
                  inspections={inspections}
                  nonConformities={nonConformities}
                  searchQuery={searchQuery}
                  onSelect={setSelectedInspection}
                  onDuplicate={(insp) => setDuplicateSourceId(insp.id)}
                />
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <CorrectiveActionTemplatesAdmin />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div
                className={`relative w-full sm:w-64 ${showSearch ? "block" : "hidden md:block"}`}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                  autoFocus={showSearch}
                />
              </div>
              <InspectionsList
                inspections={inspections}
                nonConformities={nonConformities}
                searchQuery={searchQuery}
                onSelect={setSelectedInspection}
                onDuplicate={(insp) => setDuplicateSourceId(insp.id)}
              />
            </div>
          )}
        </PageContainer>
      </div>

      {showCreateDialog && projectId && (
        <CreateInspectionDialog
          projectId={projectId}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}

      {selectedInspection && projectId && (
        <InspectionDetailDialog
          inspection={selectedInspection}
          projectId={projectId}
          open={!!selectedInspection}
          onOpenChange={(open) => !open && setSelectedInspection(null)}
          onCreateNc={(item) => {
            const inspId = selectedInspection?.id;
            setSelectedInspection(null);
            setCreateNcContext({
              inspectionId: inspId,
              inspectionItemId: item.id,
              prefillTitle: `NC: ${item.description}`,
            });
          }}
        />
      )}

      {createNcContext && projectId && (
        <CreateNcDialog
          open={!!createNcContext}
          onOpenChange={(open) => !open && setCreateNcContext(null)}
          projectId={projectId}
          inspectionId={createNcContext.inspectionId}
          inspectionItemId={createNcContext.inspectionItemId}
          prefillTitle={createNcContext.prefillTitle}
          onSuccess={() => setCreateNcContext(null)}
        />
      )}

      {duplicateSourceId && projectId && (
        <DuplicateInspectionDialog
          projectId={projectId}
          open={!!duplicateSourceId}
          onOpenChange={(open) => !open && setDuplicateSourceId(null)}
          duplicateFromInspectionId={duplicateSourceId}
        />
      )}
    </>
  );
}
