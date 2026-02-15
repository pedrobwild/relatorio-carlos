import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { JourneyStage } from '@/hooks/useProjectJourney';

interface StageDetailsSectionsProps {
  stage: JourneyStage;
}

export function StageDetailsSections({ stage }: StageDetailsSectionsProps) {
  return (
    <>
      {/* Description */}
      {stage.description && (
        <div className="prose prose-sm max-w-none text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {stage.description}
        </div>
      )}

      {/* Warning */}
      {stage.warning_text && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">{stage.warning_text}</AlertDescription>
        </Alert>
      )}

      {/* Dependencies */}
      {stage.dependencies_text && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 whitespace-pre-line text-sm">
            <span className="font-medium">Dependências:</span>
            <br />
            {stage.dependencies_text}
          </AlertDescription>
        </Alert>
      )}

      {/* Revision text */}
      {stage.revision_text && (
        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          🔁 <span className="font-medium">Revisões:</span> {stage.revision_text}
        </div>
      )}
    </>
  );
}
