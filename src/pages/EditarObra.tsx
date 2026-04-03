import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, DollarSign, Users, Save, Trash2, Loader2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserRole } from '@/hooks/useUserRole';
import { useDeleteProject } from '@/hooks/useDeleteProject';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useEditarObraData } from './editar-obra/useEditarObraData';
import { TabGeral } from './editar-obra/TabGeral';
import { TabAtividades } from './editar-obra/TabAtividades';
import { TabPagamentos } from './editar-obra/TabPagamentos';
import { TabEquipe } from './editar-obra/TabEquipe';
import { TabFichaTecnica } from './editar-obra/TabFichaTecnica';
import { EditarObraSidebar } from './editar-obra/EditarObraSidebar';

export default function EditarObra() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager, hasAnyRole } = useUserRole();
  const canEdit = isAdmin || isManager || hasAnyRole(['engineer']);
  const deleteProjectMutation = useDeleteProject();
  const [activeTab, setActiveTab] = useState('geral');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const data = useEditarObraData(projectId);

  const handleDeleteProject = async () => {
    if (!projectId) return;
    try {
      await deleteProjectMutation.mutateAsync(projectId);
      navigate('/gestao');
    } catch {
      // Error handled by mutation
    }
  };

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data.project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Obra não encontrada</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-h3 font-bold">{data.project.name}</h1>
                <p className="text-tiny text-muted-foreground">
                  {canEdit ? 'Editar dados da obra' : 'Visualizando dados da obra'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/obra/${projectId}`)}>Ver Portal</Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={canEdit ? -1 : 0}>
                    <Button onClick={data.saveProject} disabled={data.saving || !canEdit}>
                      {data.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p className="text-xs">Sua permissão é apenas de visualização</p>
                  </TooltipContent>
                )}
              </Tooltip>
              {isAdmin ? (
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Obra</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir a obra "{data.project.name}"? Esta ação é irreversível e excluirá todos os dados relacionados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteProjectMutation.isPending}>
                        {deleteProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Excluir Definitivamente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : !canEdit ? null : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="destructive" size="icon" disabled>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Apenas administradores podem excluir obras</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="geral" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Dados Gerais</span>
                </TabsTrigger>
                <TabsTrigger value="ficha" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Ficha Técnica</span>
                </TabsTrigger>
                <TabsTrigger value="atividades" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Atividades</span>
                </TabsTrigger>
                <TabsTrigger value="pagamentos" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Pagamentos</span>
                </TabsTrigger>
                <TabsTrigger value="equipe" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Equipe</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="geral">
                <TabGeral project={data.project} customer={data.customer} onProjectChange={data.handleProjectChange} onCustomerChange={data.handleCustomerChange} />
              </TabsContent>

              <TabsContent value="ficha">
                <TabFichaTecnica studioInfo={data.studioInfo} onChange={data.handleStudioInfoChange} />
              </TabsContent>

              <TabsContent value="atividades">
                <TabAtividades activities={data.activities} onAdd={data.addActivity} onUpdate={data.updateActivity} onDelete={data.deleteActivity} />
              </TabsContent>

              <TabsContent value="pagamentos">
                <TabPagamentos payments={data.payments} onAdd={data.addPayment} onUpdate={data.updatePayment} onTogglePaid={data.togglePaymentPaid} onDelete={data.deletePayment} />
              </TabsContent>

              <TabsContent value="equipe">
                <TabEquipe
                  projectId={projectId!}
                  customer={data.customer}
                  engineers={data.engineers}
                  availableEngineers={data.availableEngineers}
                  members={data.members}
                  isAddingMember={data.isAddingMember}
                  isRemovingMember={data.isRemovingMember}
                  onAddMember={data.handleAddMember}
                  onRemoveMember={data.handleRemoveMember}
                  onUpdateRole={data.handleUpdateRole}
                  onCustomerLinked={(c) => data.setCustomer(c)}
                  onCustomerAdded={(c) => data.setCustomer(c)}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Context Sidebar - hidden on mobile */}
          <aside className="hidden lg:block w-[260px] shrink-0 sticky top-20 self-start">
            <EditarObraSidebar
              project={data.project}
              studioInfo={data.studioInfo}
              customer={data.customer}
            />
          </aside>
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
