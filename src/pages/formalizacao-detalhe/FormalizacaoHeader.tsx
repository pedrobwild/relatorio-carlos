import { ArrowLeft, Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import bwildLogo from "@/assets/bwild-logo-dark.png";

interface FormalizacaoHeaderProps {
  title: string;
  status: string;
  isAdmin: boolean;
  downloadingPdf: boolean;
  isDeleting: boolean;
  onGoBack: () => void;
  onDownloadPdf: () => void;
  onDelete: () => void;
}

export function FormalizacaoHeader({
  title,
  status,
  isAdmin,
  downloadingPdf,
  isDeleting,
  onGoBack,
  onDownloadPdf,
  onDelete,
}: FormalizacaoHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onGoBack}
              aria-label="Voltar para lista"
              className="rounded-full min-h-[44px] min-w-[44px] h-11 w-11 shrink-0 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={bwildLogo} alt="Bwild" className="h-8 w-auto shrink-0" />
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="text-sm font-medium truncate hidden sm:inline">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Baixar PDF"
              onClick={onDownloadPdf}
              disabled={downloadingPdf}
              className="min-h-[44px] h-11"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {downloadingPdf ? "Gerando..." : "PDF"}
              </span>
            </Button>

            {isAdmin && status !== "signed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir formalização</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir esta formalização? Esta
                      ação é irreversível e removerá permanentemente o documento
                      e todo o histórico associado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
