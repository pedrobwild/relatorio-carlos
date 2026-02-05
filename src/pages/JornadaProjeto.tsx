 import { useState, useEffect } from 'react';
 import { useParams, useNavigate } from 'react-router-dom';
 import { ArrowLeft, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Separator } from '@/components/ui/separator';
 import { useProject } from '@/contexts/ProjectContext';
 import { useUserRole } from '@/hooks/useUserRole';
 import { useProjectJourney, useInitializeJourney } from '@/hooks/useProjectJourney';
 import { JourneyHeroSection } from '@/components/journey/JourneyHeroSection';
 import { JourneyTimeline } from '@/components/journey/JourneyTimeline';
 import { JourneyStageCard } from '@/components/journey/JourneyStageCard';
 import { JourneyFooterSection } from '@/components/journey/JourneyFooterSection';
import { JourneyCSMSection } from '@/components/journey/JourneyCSMSection';
 import bwildLogo from '@/assets/bwild-logo.png';
 
 export default function JornadaProjeto() {
   const { projectId } = useParams<{ projectId: string }>();
   const navigate = useNavigate();
   const { project, loading: projectLoading } = useProject();
   const { role, loading: roleLoading } = useUserRole();
   const { data: journey, isLoading: journeyLoading, refetch } = useProjectJourney(projectId);
   const initializeJourney = useInitializeJourney();
   
   const [activeStageId, setActiveStageId] = useState<string | null>(null);
   const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
 
   const isAdmin = role === 'admin' || role === 'manager' || role === 'engineer';
   const isLoading = projectLoading || roleLoading || journeyLoading;
 
   // Initialize journey if not exists
   useEffect(() => {
     if (!journeyLoading && journey && !journey.hero && projectId) {
       initializeJourney.mutate(projectId, {
         onSuccess: () => refetch(),
       });
     }
   }, [journeyLoading, journey, projectId, initializeJourney, refetch]);
 
   // Set first non-completed stage as active by default
   useEffect(() => {
     if (journey?.stages && !activeStageId) {
       const firstActive = journey.stages.find(
         (s) => s.status === 'waiting_action' || s.status === 'in_progress'
       ) || journey.stages[0];
       if (firstActive) {
         setActiveStageId(firstActive.id);
         setExpandedStages(new Set([firstActive.id]));
       }
     }
   }, [journey?.stages, activeStageId]);
 
   const handleStageClick = (stageId: string) => {
     setActiveStageId(stageId);
     setExpandedStages((prev) => {
       const newSet = new Set(prev);
       if (newSet.has(stageId)) {
         newSet.delete(stageId);
       } else {
         newSet.add(stageId);
       }
       return newSet;
     });
   };
 
   if (isLoading || initializeJourney.isPending) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!project) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <p className="text-muted-foreground">Projeto não encontrado</p>
       </div>
     );
   }
 
   if (!journey?.hero || !journey.stages.length) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <div className="text-center space-y-4">
           <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
           <p className="text-muted-foreground">Inicializando jornada do projeto...</p>
         </div>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
         <div className="container max-w-5xl mx-auto px-4 py-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => navigate(`/obra/${projectId}`)}
               >
                 <ArrowLeft className="h-5 w-5" />
               </Button>
               <img src={bwildLogo} alt="BWild" className="h-8" />
             </div>
             <div className="text-right">
               <p className="font-medium text-sm">{project.name}</p>
               {project.unit_name && (
                 <p className="text-xs text-muted-foreground">{project.unit_name}</p>
               )}
             </div>
           </div>
         </div>
       </header>
 
       <main className="container max-w-5xl mx-auto px-4 py-8">
         <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
           {/* Sidebar with Timeline (desktop only) */}
           <aside className="hidden lg:block">
             <div className="sticky top-24 space-y-6">
               <div>
                 <h2 className="text-sm font-medium text-muted-foreground mb-4">
                   Etapas da Jornada
                 </h2>
                 <JourneyTimeline
                   stages={journey.stages}
                   activeStageId={activeStageId}
                   onStageClick={handleStageClick}
                 />
               </div>
             </div>
           </aside>
 
           {/* Main content */}
           <div className="space-y-8">
             {/* Hero */}
             <JourneyHeroSection
               hero={journey.hero}
               projectId={projectId!}
               isAdmin={isAdmin}
             />
 
              {/* CSM Section */}
              {journey.csm && (
                <JourneyCSMSection
                  csm={journey.csm}
                  projectId={projectId!}
                  isAdmin={isAdmin}
                  onUpdate={() => refetch()}
                />
              )}

             <Separator />
 
             {/* Mobile Timeline */}
             <div className="lg:hidden">
               <h2 className="text-sm font-medium text-muted-foreground mb-4">
                 Etapas da Jornada
               </h2>
               <JourneyTimeline
                 stages={journey.stages}
                 activeStageId={activeStageId}
                 onStageClick={handleStageClick}
               />
               <Separator className="mt-6" />
             </div>
 
             {/* Stage Cards */}
             <div className="space-y-4">
               {journey.stages.map((stage) => (
                 <JourneyStageCard
                   key={stage.id}
                   stage={stage}
                   projectId={projectId!}
                   isAdmin={isAdmin}
                   isExpanded={expandedStages.has(stage.id)}
                   onToggleExpand={() => handleStageClick(stage.id)}
                 />
               ))}
             </div>
 
             <Separator />
 
             {/* Footer */}
             {journey.footer && (
               <JourneyFooterSection
                 footer={journey.footer}
                 projectId={projectId!}
                 isAdmin={isAdmin}
               />
             )}
           </div>
         </div>
       </main>
     </div>
   );
 }