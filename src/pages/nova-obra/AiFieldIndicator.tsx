import { Sparkles, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AiFieldIndicatorProps {
  fieldName: string;
  aiPrefilledFields: Set<string>;
  aiConflictFields?: Set<string>;
  className?: string;
}

export function AiFieldIndicator({
  fieldName,
  aiPrefilledFields,
  aiConflictFields,
  className,
}: AiFieldIndicatorProps) {
  const isPrefilled = aiPrefilledFields.has(fieldName);
  const isConflict = aiConflictFields?.has(fieldName);

  if (!isPrefilled && !isConflict) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center ml-1", className)}>
            {isConflict ? (
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            ) : (
              <Sparkles className="h-3 w-3 text-primary/70" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          {isConflict
            ? "Valor pode ter divergência — verifique com o contrato"
            : "Preenchido automaticamente via contrato"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
