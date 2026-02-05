 import { useState } from 'react';
 import { Edit2, Check, X } from 'lucide-react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { JourneyFooter, useUpdateFooter } from '@/hooks/useProjectJourney';
 
 interface JourneyFooterSectionProps {
   footer: JourneyFooter;
   projectId: string;
   isAdmin: boolean;
 }
 
 export function JourneyFooterSection({ footer, projectId, isAdmin }: JourneyFooterSectionProps) {
   const [isEditing, setIsEditing] = useState(false);
   const [text, setText] = useState(footer.text);
   
   const updateFooter = useUpdateFooter();
 
   const handleSave = () => {
     updateFooter.mutate({ footerId: footer.id, text, projectId });
     setIsEditing(false);
   };
 
   const handleCancel = () => {
     setText(footer.text);
     setIsEditing(false);
   };
 
   if (isEditing) {
     return (
       <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
         <CardContent className="p-6 space-y-4">
           <div className="flex items-center justify-between">
             <span className="text-sm text-muted-foreground">Editando mensagem final</span>
             <div className="flex gap-2">
               <Button size="sm" variant="ghost" onClick={handleCancel}>
                 <X className="h-4 w-4" />
               </Button>
               <Button size="sm" onClick={handleSave} disabled={updateFooter.isPending}>
                 <Check className="h-4 w-4" />
               </Button>
             </div>
           </div>
           <Textarea
             value={text}
             onChange={(e) => setText(e.target.value)}
             rows={5}
           />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card className="relative bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
       {isAdmin && (
         <Button
           size="icon"
           variant="ghost"
           className="absolute top-4 right-4 h-8 w-8"
           onClick={() => setIsEditing(true)}
         >
           <Edit2 className="h-4 w-4" />
         </Button>
       )}
       <CardContent className="p-6">
         <div className="flex items-start gap-4">
           <span className="text-3xl">🎯</span>
           <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
             {footer.text}
           </p>
         </div>
       </CardContent>
     </Card>
   );
 }