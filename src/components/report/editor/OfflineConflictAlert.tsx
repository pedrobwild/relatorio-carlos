import { CloudOff, Download, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { OfflineConflictGuard } from "./useOfflineConflict";

interface OfflineConflictAlertProps {
  guard: OfflineConflictGuard;
}

/**
 * Aviso exibido quando o relatório mudou no servidor enquanto a pessoa
 * editava sem conexão e as duas partes mexeram na mesma seção.
 */
const OfflineConflictAlert = ({ guard }: OfflineConflictAlertProps) => {
  const pending = guard.pending;
  if (!pending) return null;

  const { conflictingSections, serverSections, localSections } =
    pending.resolution;

  return (
    <Alert variant="destructive" role="alert">
      <CloudOff className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>
        O relatório mudou no servidor enquanto você estava sem conexão
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Alterações na mesma seção dos dois lados:{" "}
          <strong>{conflictingSections.join(", ")}</strong>. O envio está
          pausado para não apagar nada — escolha qual versão vale.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Você editou neste aparelho: {localSections.join(", ")}</li>
          <li>Mudou no servidor: {serverSections.join(", ")}</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={guard.keepLocal}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Manter minhas alterações
          </Button>
          <Button size="sm" variant="outline" onClick={guard.useServer}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Usar a versão do servidor
          </Button>
        </div>
        <p className="text-xs">
          Seções que só mudaram no servidor entram automaticamente nas duas
          opções. Nada é perdido: cada salvamento fica no histórico de versões.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default OfflineConflictAlert;
