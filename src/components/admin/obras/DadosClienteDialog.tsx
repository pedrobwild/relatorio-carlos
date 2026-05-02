/**
 * DadosClienteDialog — abre a feature "Dados do Cliente" como popup.
 *
 * Comportamento responsivo:
 *  - Desktop (≥ md): Dialog centralizado (≤960px), header sticky e
 *    body rolável internamente. Mantido o padrão Linear/Notion para
 *    edição lado-a-lado da listagem.
 *  - Mobile (< md): MobileFullscreenSheet — full-screen com header
 *    sticky, body rolável que respeita safe-area, e a sticky save
 *    bar provida pelo próprio `DadosCliente` (modo `embedded`).
 *
 * Reutiliza integralmente a página `DadosCliente` passando `projectId`
 * via prop, sem duplicar lógica de fetch/save.
 */
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MobileFullscreenSheet } from '@/components/mobile';
import DadosCliente from '@/pages/DadosCliente';

interface DadosClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName?: string | null;
  customerName?: string | null;
}

function buildSubtitle(customerName?: string | null, projectName?: string | null) {
  if (!customerName && !projectName) return 'Informações cadastrais e do projeto';
  if (customerName && projectName) return `${customerName} · ${projectName}`;
  return customerName ?? projectName ?? '';
}

export function DadosClienteDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  customerName,
}: DadosClienteDialogProps) {
  const isMobile = useIsMobile();
  const subtitle = buildSubtitle(customerName, projectName);

  // ── Mobile: full-screen sheet com header sticky e safe-area. Save fica
  //    sticky dentro de DadosCliente (embedded), evitando conflito com a
  //    bottom navigation e safe-area inferior. Não usa Dialog centralizado.
  if (isMobile) {
    return (
      <MobileFullscreenSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Dados do cliente"
        description={subtitle}
        closeAriaLabel="Voltar para a listagem"
      >
        {projectId ? (
          <DadosCliente projectId={projectId} embedded />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Selecione uma obra.</p>
        )}
      </MobileFullscreenSheet>
    );
  }

  // ── Desktop: dialog centralizado (preserva o comportamento original).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(960px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border-subtle sticky top-0 bg-background z-10">
          <DialogTitle className="text-lg">Dados do cliente</DialogTitle>
          <DialogDescription className="text-xs truncate">
            {customerName ? <span className="font-medium text-foreground">{customerName}</span> : null}
            {customerName && projectName ? <span className="opacity-50"> · </span> : null}
            {projectName ? <span>{projectName}</span> : null}
            {!customerName && !projectName ? 'Informações cadastrais e do projeto' : null}
          </DialogDescription>
        </DialogHeader>

        {projectId ? (
          <DadosCliente projectId={projectId} embedded />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Selecione uma obra.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
