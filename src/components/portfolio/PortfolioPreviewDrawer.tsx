import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ProjectWithCustomer } from '@/infra/repositories';

interface PortfolioPreviewDrawerProps {
  project: ProjectWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-over drawer for quick-previewing a project without navigating away.
 * Placeholder — will be populated with summary data, health score, and actions.
 */
export function PortfolioPreviewDrawer({
  project,
  open,
  onOpenChange,
}: PortfolioPreviewDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">
            {project?.name ?? 'Detalhes da Obra'}
          </SheetTitle>
        </SheetHeader>

        {project ? (
          <div className="mt-6 space-y-6">
            {/* Placeholder sections */}
            <PlaceholderBlock label="Saúde & Progresso" />
            <PlaceholderBlock label="Próximos Marcos" />
            <PlaceholderBlock label="Pendências" />
            <PlaceholderBlock label="Ações Rápidas" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Selecione uma obra para ver o resumo
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlaceholderBlock({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
