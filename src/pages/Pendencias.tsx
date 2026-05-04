import { useParams } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePendencias } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageSkeleton } from "@/components/ui-premium";
import { EmptyState } from "@/components/EmptyState";
import { PendenciaItemCard } from "@/components/tabs/PendenciaItemCard";

const Pendencias = () => {
  const { projectId } = useParams();
  const { sortedItems, stats, isLoading } = usePendencias({ projectId });
  const { paths } = useProjectNavigation();

  const getActionUrl = (item: typeof sortedItems[0]) => {
    if (item.actionUrl) return item.actionUrl;
    switch (item.type) {
      case "invoice": return paths.financeiro;
      case "signature": return paths.formalizacoes;
      case "approval_3d": return paths.projeto3D;
      case "approval_exec": return paths.executivo;
      default: return paths.relatorio;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Pendências"
          backTo={paths.relatorio}
          maxWidth="xl"
          breadcrumbs={[
            { label: "Minhas Obras", href: "/minhas-obras" },
            { label: "Obra", href: paths.relatorio },
            { label: "Pendências" },
          ]}
        />
        <main className="py-6">
          <PageContainer maxWidth="xl">
            <PageSkeleton metrics content="cards" />
          </PageContainer>
        </main>
      </div>
    );
  }

  const summaryCards = (
    <>
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
            <span className="text-caption md:text-sm text-rose-600 font-medium">Atrasados</span>
          </div>
          <p className="text-h2 md:text-2xl font-bold text-rose-600">{stats.overdueCount}</p>
        </div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
            <span className="text-caption md:text-sm text-amber-600 font-medium">Urgentes</span>
          </div>
          <p className="text-h2 md:text-2xl font-bold text-amber-600">{stats.urgentCount}</p>
        </div>
      </div>
    </>
  );

  const infoBanner = (
    <Alert className="border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-caption text-foreground/80">
        <strong>Importante:</strong> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
      </AlertDescription>
    </Alert>
  );

  const itemsList = (compact: boolean) => (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {sortedItems.map((item, index) => (
        <PendenciaItemCard
          key={item.id}
          item={item}
          index={index}
          actionUrl={getActionUrl(item)}
          compact={compact}
        />
      ))}
      {sortedItems.length === 0 && (
        <div className="bg-card rounded-lg border border-border">
          <EmptyState
            icon={CheckCircle2}
            title="Tudo em dia!"
            description="Não há pendências no momento."
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Pendências"
        backTo={paths.relatorio}
        maxWidth="xl"
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: "Obra", href: paths.relatorio },
          { label: "Pendências" },
        ]}
      />

      <main className="py-6">
        <PageContainer maxWidth="xl">
          {/* Desktop: Two-column layout */}
          <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
            <div className="space-y-4 sticky top-20 h-fit">
              <div className="space-y-2">
                {summaryCards}
                <div className="bg-secondary border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Total pendentes</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </div>
              {infoBanner}
            </div>
            {itemsList(false)}
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {summaryCards}
            </div>
            <div className="mb-4">{infoBanner}</div>
            {itemsList(true)}
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Pendencias;
