import { useRef } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
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

interface BoletoUploadButtonProps {
  paymentId: string;
  projectId: string;
  boletoPath: string | null;
}

export function BoletoUploadButton({
  paymentId,
  projectId,
  boletoPath,
}: BoletoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useBoletoUpload();
  const deleteMutation = useBoletoDelete();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate({ paymentId, projectId, file });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = () => {
    if (boletoPath) {
      deleteMutation.mutate({ paymentId, boletoPath });
    }
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
              Esta ação não pode ser desfeita. O boleto será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
