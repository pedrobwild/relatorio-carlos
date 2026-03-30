import { useState, useMemo } from 'react';
import { Plus, ClipboardCheck, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useProject } from '@/contexts/ProjectContext';
import { useInspections, useNonConformities } from '@/hooks/useInspections';
import { InspectionsList } from '@/components/vistorias/InspectionsList';
import { NonConformitiesList } from '@/components/vistorias/NonConformitiesList';
import { CreateInspectionDialog } from '@/components/vistorias/CreateInspectionDialog';
import { InspectionDetailDialog } from '@/components/vistorias/InspectionDetailDialog';
import { NcDetailDialog } from '@/components/vistorias/NcDetailDialog';
import { CreateNcDialog } from '@/components/vistorias/CreateNcDialog';
import type { Inspection, NonConformity, InspectionItem } from '@/hooks/useInspections';

export default function Vistorias() {
  const { projectId } = useProjectNavigation();
  const { project } = useProject();
  const { data: inspections = [], isLoading: loadingInspections } = useInspections(projectId);
  const { data: nonConformities = [], isLoading: loadingNcs } = useNonConformities(projectId);

  const [tab, setTab] = useState('vistorias');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedNc, setSelectedNc] = useState<NonConformity | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [createNcContext, setCreateNcContext] = useState<{
    inspectionId?: string;
    inspectionItemId?: string;
    prefillTitle?: string;
  } | null>(null);

  const openNcs = useMemo(() => nonConformities.filter(nc => nc.status !== 'closed'), [nonConformities]);

  const isLoading = loadingInspections || loadingNcs;

  if (isLoading) {
    return (
      <div className="py-6">
        <PageContainer maxWidth="full">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Vistorias & NC"
        maxWidth="full"
        showLogo={false}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            onClick={() => setShowSearch(prev => !prev)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2 h-10 min-w-[44px]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Vistoria</span>
          </Button>
        </div>
      </PageHeader>

      <div className="py-4 md:py-6">
        <PageContainer maxWidth="full">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <TabsList className="w-full sm:w-auto overflow-x-auto">
                <TabsTrigger value="vistorias" className="gap-1.5 min-h-[44px] flex-1 sm:flex-none">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden xs:inline">Vistorias</span>
                  <Badge variant="secondary" className="ml-1">{inspections.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ncs" className="gap-1.5 min-h-[44px] flex-1 sm:flex-none">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="truncate">NCs</span>
                  {openNcs.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{openNcs.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Desktop search always visible, mobile toggle */}
              <div className={`relative w-full sm:w-64 ${showSearch ? 'block' : 'hidden md:block'}`}>
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
                searchQuery={searchQuery}
                onSelect={setSelectedInspection}
              />
            </TabsContent>

            <TabsContent value="ncs">
              <NonConformitiesList
                nonConformities={nonConformities}
                searchQuery={searchQuery}
                onSelect={setSelectedNc}
              />
            </TabsContent>
          </Tabs>
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

      {selectedNc && (
        <NcDetailDialog
          nc={selectedNc}
          open={!!selectedNc}
          onOpenChange={(open) => !open && setSelectedNc(null)}
        />
      )}
    </>
  );
}
