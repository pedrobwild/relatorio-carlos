/**
 * Botão de upload de boleto com fallback inline em caso de falha.
 *
 * Fluxo (issue #21 — Bloco 4.3):
 *   1. Sem boleto    → "Anexar" (abre seletor de arquivo).
 *   2. Com boleto    → "Remover" (com confirmação).
 *   3. Erro recente  → mensagem inline + "Tentar novamente" + "Reportar".
 *
 * O bloco de erro persiste até o usuário tentar novamente ou cancelar — a UX
 * antiga sumia com o toast e o gestor ficava sem entender o que aconteceu.
 *
 * Nota: a issue cita "PIX expirado / link inválido" como fluxos paralelos.
 * Esses casos exigem schema (pix_qr, pix_expires_at, payment_link*) que ainda
 * não existe — quando entrarem, o mesmo padrão de fallback inline aplica.
 */
import { useRef, useState, useEffect } from "react";
import { AlertCircle, Loader2, RefreshCw, Send, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBoletoUpload, useBoletoDelete } from "@/hooks/useBoletoUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { logError } from "@/lib/errorLogger";
import { toast } from "sonner";

interface BoletoUploadButtonProps {
  paymentId: string;
  projectId: string;
  boletoPath: string | null;
}

interface FailureState {
  message: string;
  /** Arquivo que falhou — mantido para o "Tentar novamente". */
  lastFile: File | null;
  reason: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'PERMISSION' | 'NETWORK' | 'UNKNOWN';
}

function classifyError(error: Error & { code?: string }): FailureState['reason'] {
  if (error.code === 'INVALID_TYPE') return 'INVALID_TYPE';
  if (error.code === 'FILE_TOO_LARGE') return 'FILE_TOO_LARGE';
  if (error.message?.includes('row-level security')) return 'PERMISSION';
  if (error.message?.toLowerCase().includes('network')) return 'NETWORK';
  return 'UNKNOWN';
}

function describe(reason: FailureState['reason']): string {
  switch (reason) {
    case 'INVALID_TYPE':
      return 'Tipo de arquivo não suportado. Use PDF, PNG ou JPEG.';
    case 'FILE_TOO_LARGE':
      return 'Arquivo acima de 10MB. Reduza ou comprima antes de anexar.';
    case 'PERMISSION':
      return 'Sem permissão para anexar este boleto.';
    case 'NETWORK':
      return 'Conexão instável. Verifique sua internet e tente novamente.';
    default:
      return 'Não foi possível anexar o boleto.';
  }
}

export function BoletoUploadButton({ paymentId, projectId, boletoPath }: BoletoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useBoletoUpload();
  const deleteMutation = useBoletoDelete();
  const [failure, setFailure] = useState<FailureState | null>(null);

  // Limpa fallback ao trocar de payment ou quando o boleto fica anexado.
  useEffect(() => {
    if (boletoPath) setFailure(null);
  }, [boletoPath, paymentId]);

  const triggerUpload = (file: File) => {
    setFailure(null);
    uploadMutation.mutate(
      { paymentId, projectId, file },
      {
        onError: (err) => {
          const e = err as Error & { code?: string };
          const reason = classifyError(e);
          setFailure({ message: describe(reason), lastFile: file, reason });
        },
      },
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) triggerUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = () => {
    if (boletoPath) deleteMutation.mutate({ paymentId, boletoPath });
  };

  const handleRetry = () => {
    if (failure?.lastFile) {
      triggerUpload(failure.lastFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleReport = () => {
    logError('User reported boleto upload issue', new Error(failure?.message ?? 'Boleto upload failed'), {
      component: 'BoletoUploadButton',
      paymentId,
      projectId,
      reason: failure?.reason,
    });
    toast.success('Problema reportado. Nossa equipe vai verificar.');
    setFailure(null);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  if (boletoPath) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 min-h-[44px] px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Remover
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover boleto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O boleto será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (failure) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[260px]">
        <p className="text-[11px] text-destructive flex items-start gap-1 leading-snug text-right">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{failure.message}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handleRetry}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Tentar novamente
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={handleReport}
            disabled={isLoading}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Reportar
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-11 min-h-[44px] px-3 text-xs text-primary hover:text-primary hover:bg-primary/10"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            <Upload className="w-3.5 h-3.5 mr-1" />
            Anexar
          </>
        )}
      </Button>
    </>
  );
}
