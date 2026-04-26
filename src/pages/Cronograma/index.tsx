/**
 * Página Cronograma — container.
 *
 * Compõe os pedaços (`CronogramaToolbar`, `CronogramaTable`, `WeightProgress`,
 * `CronogramaImports`) e delega o estado de edição ao hook
 * `useCronogramaState`.
 *
 * Mantida deliberadamente curta (< 200 linhas) — toda lógica de edição
 * vive no hook; toda regra visual de status/peso vive em libs reutilizáveis.
 */
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { CronogramaMobileView } from '@/components/cronograma/CronogramaMobileView';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { CronogramaImports } from './CronogramaImports';
import { CronogramaTable } from './CronogramaTable';
import { CronogramaToolbar } from './CronogramaToolbar';
import { WeightProgress } from './WeightProgress';
import { useCronogramaState } from './useCronogramaState';

const Cronograma = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const isMobile = useIsMobile();

  const state = useCronogramaState({
    project,
    projectId,
    redirectPathOnSave: paths.relatorio,
  });

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/gestao', { replace: true });
  };

  const breadcrumbs = [
    { label: 'Gestão', href: '/gestao' },
    { label: project?.name || 'Obra', href: `/obra/${projectId}` },
    { label: 'Cronograma' },
  ];

  if (projectLoading || state.activitiesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Cronograma"
          showLogo={false}
          maxWidth="md"
          onBack={() => navigate(-1)}
          breadcrumbs={[{ label: 'Gestão', href: '/gestao' }, { label: 'Cronograma' }]}
        />
        <div className="max-w-7xl mx-auto p-4">
          <ContentSkeleton variant="table" rows={6} />
        </div>
      </div>
    );
  }

  // Mobile: visão de monitoramento (a menos que o usuário entre em modo edição).
  if (isMobile && !state.mobileEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Cronograma"
          showLogo={false}
          maxWidth="md"
          onBack={goBack}
          breadcrumbs={breadcrumbs}
        />
        <div className="max-w-lg mx-auto p-4">
          <CronogramaMobileView
            activities={state.existingActivities}
            loading={state.activitiesLoading}
            hasBaseline={state.hasBaseline}
            onEditMode={() => state.setMobileEditMode(true)}
            onImport={() => state.setImportModalOpen(true)}
            onSaveBaseline={state.handleSaveBaseline}
            projectName={project?.name}
          />
        </div>
        <CronogramaImports
          open={state.importModalOpen}
          onOpenChange={state.setImportModalOpen}
          onImport={state.handleImportActivities}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Cronograma"
        showLogo={false}
        maxWidth="md"
        onBack={goBack}
        breadcrumbs={breadcrumbs}
      >
        <CronogramaToolbar
          projectId={projectId}
          projectName={project?.name}
          plannedStartDate={project?.planned_start_date}
          plannedEndDate={project?.planned_end_date}
          comprasPath={paths.compras}
          hasBaseline={state.hasBaseline}
          saving={state.saving}
          savingBaseline={state.savingBaseline}
          hasActivities={state.activities.length > 0}
          onSaveBaseline={state.handleSaveBaseline}
          onOpenImport={() => state.setImportModalOpen(true)}
          onSave={state.handleSave}
        />
      </PageHeader>

      <div className="max-w-7xl mx-auto p-4 pb-24 space-y-4">
        <CronogramaTable
          activities={state.activities}
          dateValidationErrors={state.dateValidationErrors}
          openDetails={state.openDetails}
          setOpenDetails={state.setOpenDetails}
          draggedIndex={state.draggedIndex}
          dragOverIndex={state.dragOverIndex}
          onDragStart={state.handleDragStart}
          onDragEnd={state.clearDragState}
          onRowDragOver={state.handleRowDragOver}
          onRowDrop={state.handleRowDrop}
          onChange={state.handleActivityChange}
          onRemove={state.handleRemoveActivity}
        />
      </div>

      {/* Sticky bottom toolbar: Adicionar atividade + WeightProgress */}
      <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto p-3 flex items-center gap-3 flex-wrap">
          <Button onClick={state.handleAddActivity} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Adicionar atividade
          </Button>
          <WeightProgress total={state.totalWeight} className="flex-1 min-w-[260px]" />
        </div>
      </div>

      <CronogramaImports
        open={state.importModalOpen}
        onOpenChange={state.setImportModalOpen}
        onImport={state.handleImportActivities}
      />
    </div>
  );
};

export default Cronograma;
