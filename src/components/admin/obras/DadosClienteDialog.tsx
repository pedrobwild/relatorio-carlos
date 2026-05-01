/**
 * DadosClienteDialog — abre a feature "Dados do Cliente" em popup,
 * usado a partir do Painel de Obras (coluna do ícone de documento).
 *
 * Reutiliza integralmente a página `DadosCliente` passando `projectId`
 * via prop, sem duplicar lógica de fetch/save. O Dialog é largo
 * (até ~960px) e rola internamente para acomodar as 3 abas
 * (Contratante / Imóvel / Informações do Projeto — rich text).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DadosCliente from '@/pages/DadosCliente';

interface DadosClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName?: string | null;
  customerName?: string | null;
}

export function DadosClienteDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  customerName,
}: DadosClienteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Largura controlada para acomodar formulários em 2 colunas + área
        // de rich text confortável. `max-h` + overflow para evitar que o
        // dialog estoure a viewport em telas menores.
        className="max-w-[min(960px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border-subtle sticky top-0 bg-background z-10">
          <DialogTitle className="text-lg">Dados do cliente</DialogTitle>
          <DialogDescription className="text-xs">
            {customerName ? <span className="font-medium text-foreground">{customerName}</span> : null}
            {customerName && projectName ? <span className="opacity-50"> · </span> : null}
            {projectName ? <span>{projectName}</span> : null}
            {!customerName && !projectName ? 'Informações cadastrais e do projeto' : null}
          </DialogDescription>
        </DialogHeader>

        {projectId ? (
          // O componente já tem padding interno; removemos o padding do
          // DialogContent (p-0) para evitar dupla margem.
          <DadosCliente projectId={projectId} />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Selecione uma obra.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
