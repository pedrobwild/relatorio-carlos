import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DuplicateProjectMatch } from "@/infra/repositories/projects.repository";

interface DuplicateProjectDialogProps {
  duplicate: DuplicateProjectMatch | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bloqueia a criação de uma obra já cadastrada para o mesmo cliente,
 * no mesmo endereço e na mesma unidade, oferecendo o link para a obra existente.
 */
export function DuplicateProjectDialog({
  duplicate,
  onOpenChange,
}: DuplicateProjectDialogProps) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={!!duplicate} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            Esta obra já está cadastrada
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                Já existe uma obra para este cliente no mesmo endereço e na
                mesma unidade. Para não duplicar o acompanhamento, abra a obra
                existente em vez de criar uma nova.
              </p>
              {duplicate && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    {duplicate.project_name}
                  </p>
                  {duplicate.unit_name && (
                    <p className="text-muted-foreground">
                      Unidade: {duplicate.unit_name}
                    </p>
                  )}
                  {duplicate.address && (
                    <p className="text-muted-foreground">{duplicate.address}</p>
                  )}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Revisar dados</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              duplicate && navigate(`/obra/${duplicate.project_id}`)
            }
          >
            Abrir obra existente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
