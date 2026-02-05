 import { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { FileCode, FileText, Building, ChevronRight, Calendar, MapPin } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Separator } from '@/components/ui/separator';
 import { Badge } from '@/components/ui/badge';
 import { ProjectJourney } from '@/components/ProjectJourney';
 import { useProject } from '@/contexts/ProjectContext';
 import { supabase } from '@/integrations/supabase/client';
 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import bwildLogo from '@/assets/bwild-logo.png';
 
 type JourneyStep = 'projeto_3d' | 'projeto_executivo' | 'liberacao' | 'completed';
 
 interface DocumentStatus {
   projeto_3d: 'pending' | 'approved' | 'none';
   projeto_executivo: 'pending' | 'approved' | 'none';
   liberacao: 'pending' | 'approved' | 'none';
 }
 
 export default function PortalJornada() {
   const navigate = useNavigate();
   const { project, loading: projectLoading } = useProject();
   const [documentStatus, setDocumentStatus] = useState<DocumentStatus>({
     projeto_3d: 'none',
     projeto_executivo: 'none',
     liberacao: 'none',
   });
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     async function fetchDocumentStatus() {
       if (!project?.id) return;
       
       try {
         const { data: documents } = await supabase
           .from('project_documents')
           .select('document_type, status')
           .eq('project_id', project.id)
           .in('document_type', ['projeto_3d', 'projeto_executivo', 'liberacao_condominio'])
           .is('parent_document_id', null);
 
         if (documents) {
           const status: DocumentStatus = {
             projeto_3d: 'none',
             projeto_executivo: 'none',
             liberacao: 'none',
           };
 
           documents.forEach(doc => {
             if (doc.document_type === 'projeto_3d') {
               status.projeto_3d = doc.status === 'approved' ? 'approved' : 'pending';
             } else if (doc.document_type === 'projeto_executivo') {
               status.projeto_executivo = doc.status === 'approved' ? 'approved' : 'pending';
             } else if (doc.document_type === 'liberacao_condominio') {
               status.liberacao = doc.status === 'approved' ? 'approved' : 'pending';
             }
           });
 
           setDocumentStatus(status);
         }
       } catch (error) {
         console.error('Error fetching document status:', error);
       } finally {
         setLoading(false);
       }
     }
 
     fetchDocumentStatus();
   }, [project?.id]);
 
   const getCurrentStep = (): JourneyStep => {
     if (documentStatus.liberacao === 'approved') return 'completed';
     if (documentStatus.projeto_executivo === 'approved') return 'liberacao';
     if (documentStatus.projeto_3d === 'approved') return 'projeto_executivo';
     return 'projeto_3d';
   };
 
   if (projectLoading || loading) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <div className="animate-pulse text-muted-foreground">Carregando...</div>
       </div>
     );
   }
 
   if (!project) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <div className="text-muted-foreground">Projeto não encontrado</div>
       </div>
     );
   }
 
   const currentStep = getCurrentStep();
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
         <div className="container max-w-4xl mx-auto px-4 py-4">
           <div className="flex items-center justify-between">
             <img src={bwildLogo} alt="BWild" className="h-8" />
             <Badge variant="outline" className="text-xs">
               Fase de Projeto
             </Badge>
           </div>
         </div>
       </header>
 
       <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
         {/* Project Info */}
         <div className="space-y-2">
           <h1 className="text-2xl font-bold">{project.name}</h1>
           {project.unit_name && (
             <p className="text-muted-foreground flex items-center gap-2">
               <MapPin className="h-4 w-4" />
               {project.unit_name}
             </p>
           )}
           {project.planned_start_date && (
             <p className="text-sm text-muted-foreground flex items-center gap-2">
               <Calendar className="h-4 w-4" />
               Previsão de início: {format(new Date(project.planned_start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
             </p>
           )}
         </div>
 
         <Separator />
 
         {/* Journey Progress */}
         <div className="space-y-4">
           <h2 className="text-lg font-semibold">Jornada do Projeto</h2>
           <p className="text-sm text-muted-foreground">
             Acompanhe as etapas de aprovação antes do início da obra
           </p>
           <ProjectJourney currentStep={currentStep} className="mt-6" />
         </div>
 
         <Separator />
 
         {/* Action Cards */}
         <div className="grid gap-4">
           {/* Projeto 3D Card */}
           <Card 
             className={`cursor-pointer transition-all hover:shadow-md ${
               currentStep === 'projeto_3d' ? 'ring-2 ring-primary' : ''
             }`}
             onClick={() => navigate(`/obra/${project.id}/projeto-3d`)}
           >
             <CardContent className="p-6">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="p-3 rounded-lg bg-primary/10">
                     <FileCode className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                     <h3 className="font-semibold">Projeto 3D</h3>
                     <p className="text-sm text-muted-foreground">
                       {documentStatus.projeto_3d === 'approved' 
                         ? 'Aprovado ✓' 
                         : documentStatus.projeto_3d === 'pending'
                         ? 'Aguardando sua aprovação'
                         : 'Em desenvolvimento'}
                     </p>
                   </div>
                 </div>
                 <ChevronRight className="h-5 w-5 text-muted-foreground" />
               </div>
             </CardContent>
           </Card>
 
           {/* Projeto Executivo Card */}
           <Card 
             className={`cursor-pointer transition-all hover:shadow-md ${
               currentStep === 'projeto_executivo' ? 'ring-2 ring-primary' : ''
             } ${documentStatus.projeto_3d !== 'approved' ? 'opacity-50' : ''}`}
             onClick={() => documentStatus.projeto_3d === 'approved' && navigate(`/obra/${project.id}/executivo`)}
           >
             <CardContent className="p-6">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="p-3 rounded-lg bg-secondary/50">
                     <FileText className="h-6 w-6 text-secondary-foreground" />
                   </div>
                   <div>
                     <h3 className="font-semibold">Projeto Executivo</h3>
                     <p className="text-sm text-muted-foreground">
                       {documentStatus.projeto_executivo === 'approved' 
                         ? 'Aprovado ✓' 
                         : documentStatus.projeto_executivo === 'pending'
                         ? 'Aguardando sua aprovação'
                         : documentStatus.projeto_3d === 'approved'
                         ? 'Em desenvolvimento'
                         : 'Disponível após aprovação do Projeto 3D'}
                     </p>
                   </div>
                 </div>
                 <ChevronRight className="h-5 w-5 text-muted-foreground" />
               </div>
             </CardContent>
           </Card>
 
           {/* Liberação Card */}
           <Card 
             className={`cursor-pointer transition-all hover:shadow-md ${
               currentStep === 'liberacao' ? 'ring-2 ring-primary' : ''
             } ${documentStatus.projeto_executivo !== 'approved' ? 'opacity-50' : ''}`}
             onClick={() => documentStatus.projeto_executivo === 'approved' && navigate(`/obra/${project.id}/documentos`)}
           >
             <CardContent className="p-6">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="p-3 rounded-lg bg-muted">
                     <Building className="h-6 w-6 text-muted-foreground" />
                   </div>
                   <div>
                     <h3 className="font-semibold">Liberação pelo Condomínio</h3>
                     <p className="text-sm text-muted-foreground">
                       {documentStatus.liberacao === 'approved' 
                         ? 'Aprovado ✓' 
                         : documentStatus.liberacao === 'pending'
                         ? 'Em análise pelo condomínio'
                         : documentStatus.projeto_executivo === 'approved'
                         ? 'Aguardando submissão'
                         : 'Disponível após aprovação do Projeto Executivo'}
                     </p>
                   </div>
                 </div>
                 <ChevronRight className="h-5 w-5 text-muted-foreground" />
               </div>
             </CardContent>
           </Card>
         </div>
 
         {/* Completed Message */}
         {currentStep === 'completed' && (
           <Card className="bg-primary/5 border-primary/20">
             <CardContent className="p-6 text-center space-y-4">
               <div className="text-4xl">🎉</div>
               <div>
                 <h3 className="font-semibold text-lg">Parabéns!</h3>
                 <p className="text-sm text-muted-foreground">
                   Todas as etapas de aprovação foram concluídas. Sua obra está liberada para iniciar!
                 </p>
               </div>
               <Button onClick={() => navigate(`/obra/${project.id}/relatorio`)}>
                 Acompanhar a Obra
               </Button>
             </CardContent>
           </Card>
         )}
 
         {/* Help Card */}
         <Card className="bg-muted/30">
           <CardContent className="p-6">
             <div className="flex items-start gap-4">
               <div className="text-2xl">💬</div>
               <div>
                 <h3 className="font-medium">Precisa de ajuda?</h3>
                 <p className="text-sm text-muted-foreground mt-1">
                   Entre em contato com nossa equipe para tirar dúvidas sobre o andamento do projeto.
                 </p>
                 <Button variant="link" className="px-0 mt-2" onClick={() => navigate(`/obra/${project.id}/suporte`)}>
                   Falar com a equipe
                 </Button>
               </div>
             </div>
           </CardContent>
         </Card>
       </main>
     </div>
   );
 }