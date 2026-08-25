import { CloudUpload, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PhotoUploadQueueState } from "@/hooks/usePhotoUploadQueue";

const PendingUploadsBanner = ({
  pending,
  isProcessing,
  blocked,
  retryNow,
}: PhotoUploadQueueState) => {
  if (pending.length === 0) return null;

  const hasBlocked = blocked.length > 0;

  return (
    <Alert variant={hasBlocked ? "destructive" : "default"} role="status">
      {hasBlocked ? (
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      ) : isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CloudUpload className="h-4 w-4" aria-hidden="true" />
      )}
      <AlertTitle>
        {hasBlocked
          ? `${blocked.length} arquivo(s) não enviados`
          : isProcessing
            ? `Enviando ${pending.length} arquivo(s)…`
            : `${pending.length} arquivo(s) na fila de envio`}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>
          {hasBlocked
            ? "As tentativas automáticas falharam. Os arquivos continuam salvos no aparelho — tente reenviar."
            : "Os arquivos ficam guardados no aparelho e o envio continua sozinho, mesmo se você sair desta tela ou perder o sinal."}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={retryNow}
          disabled={isProcessing}
          className="min-h-[36px]"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Reenviar agora
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default PendingUploadsBanner;
