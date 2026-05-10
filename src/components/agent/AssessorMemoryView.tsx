/**
 * Visualização da memória stateful do projeto (snapshot atual).
 */

import { Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ProjectState } from "@/infra/repositories/agentMemory.repository";
import { STATE_SECTION_LABEL } from "./labels";

interface AssessorMemoryViewProps {
  isLoading: boolean;
  state: ProjectState | null;
  version?: number;
  updatedAt?: string;
}

export function AssessorMemoryView({
  isLoading,
  state,
  version,
  updatedAt,
}: AssessorMemoryViewProps) {
  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!state || Object.keys(state).length === 0) {
    return (
      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Memória vazia — nenhuma consulta ainda preencheu o estado deste
          projeto.
        </AlertDescription>
      </Alert>
    );
  }

  const sections = (
    Object.keys(STATE_SECTION_LABEL) as Array<keyof ProjectState>
  )
    .map((key) => [key, state[key]] as const)
    .filter(([, value]) => value && Object.keys(value).length > 0);

  return (
    <div className="mt-6 space-y-4">
      <div className="text-xs text-muted-foreground flex items-center gap-3">
        {typeof version === "number" && <span>versão {version}</span>}
        {updatedAt && (
          <span>
            atualizado{" "}
            {formatDistanceToNow(new Date(updatedAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        )}
      </div>
      <Accordion
        type="multiple"
        defaultValue={sections.map(([k]) => String(k))}
      >
        {sections.map(([key, value]) => (
          <AccordionItem key={String(key)} value={String(key)}>
            <AccordionTrigger className="text-sm">
              {STATE_SECTION_LABEL[key]}
            </AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
