import { useState, useMemo } from 'react';
import { Plus, ClipboardCheck, AlertTriangle, Search, Filter } from 'lucide-react';
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
import type { Inspection, NonConformity } from '@/hooks/useInspections';

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
        <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Vistoria
        </Button>
      </PageHeader>

      <div className="py-6">
        <PageContainer maxWidth="full">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="vistorias" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Vistorias
                  <Badge variant="secondary" className="ml-1">{inspections.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ncs" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Não Conformidades
                  {openNcs.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{openNcs.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
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
            setSelectedInspection(null);
            // will be handled by NcDetailDialog in create mode
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
