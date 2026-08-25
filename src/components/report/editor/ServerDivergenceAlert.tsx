import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ServerStateCheck } from "./useServerStateCheck";

interface ServerDivergenceAlertProps {
  check: ServerStateCheck;
  onUseServerVersion: () => void;
}

/**
 * Aviso exibido quando o relatório aberto na tela não bate com o que está
 * salvo no servidor. Enquanto a pessoa não escolher, o autosave fica parado.
 */
const ServerDivergenceAlert = ({
  check,
  onUseServerVersion,
}: ServerDivergenceAlertProps) => {
  if (check.status === "checking") {
    return (
      <p
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Conferindo se esta é a versão mais recente do relatório...
      </p>
    );
  }

  if (check.status !== "diverged") return null;

  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Esta tela está diferente do que está salvo</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          O relatório salvo no servidor mudou desde que esta tela carregou
          {check.divergentSections.length > 0 && (
            <> — divergência em: {check.divergentSections.join(", ")}</>
          )}
          . O salvamento automático está pausado para não apagar nada. Escolha
          como continuar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onUseServerVersion}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Carregar versão do servidor
          </Button>
          <Button size="sm" variant="outline" onClick={check.keepLocal}>
            Manter o que está na tela
          </Button>
        </div>
        <p className="text-xs">
          Nada é perdido: cada salvamento fica guardado no histórico de
          versões.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default ServerDivergenceAlert;
