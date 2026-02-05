 import { Check, Clock, AlertCircle, Circle } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { JourneyStage, JourneyStageStatus } from '@/hooks/useProjectJourney';
 
 interface JourneyTimelineProps {
   stages: JourneyStage[];
   activeStageId: string | null;
   onStageClick: (stageId: string) => void;
 }
 
 const statusConfig: Record<JourneyStageStatus, { icon: React.ElementType; color: string; bgColor: string }> = {
   completed: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
   in_progress: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
   waiting_action: { icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-100' },
   pending: { icon: Circle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
 };
 
 export function JourneyTimeline({ stages, activeStageId, onStageClick }: JourneyTimelineProps) {
   return (
     <div className="relative">
       {/* Vertical line */}
       <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
       
       <div className="space-y-1">
         {stages.map((stage, index) => {
           const config = statusConfig[stage.status];
           const Icon = config.icon;
           const isActive = stage.id === activeStageId;
           const isCompleted = stage.status === 'completed';
           
           return (
             <button
               key={stage.id}
               onClick={() => onStageClick(stage.id)}
               className={cn(
                 "relative flex items-center gap-4 w-full p-3 rounded-lg text-left transition-all",
                 "hover:bg-muted/50",
                 isActive && "bg-primary/5 ring-1 ring-primary/20"
               )}
             >
               {/* Status icon */}
               <div
                 className={cn(
                   "relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                   config.bgColor
                 )}
               >
                 <Icon className={cn("h-4 w-4", config.color)} />
               </div>
               
               {/* Stage info */}
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2">
                   <span
                     className={cn(
                       "font-medium text-sm truncate",
                       isCompleted && "text-muted-foreground line-through"
                     )}
                   >
                     {stage.name}
                   </span>
                 </div>
                 <span className="text-xs text-muted-foreground">
                   {stage.status === 'completed' && 'Concluído'}
                   {stage.status === 'in_progress' && 'Em andamento'}
                   {stage.status === 'waiting_action' && 'Aguardando ação'}
                   {stage.status === 'pending' && 'Em breve'}
                 </span>
               </div>
             </button>
           );
         })}
       </div>
     </div>
   );
 }