import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePendencias, type PendingItem } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { PageSkeleton, SummaryChips, type SummaryChip } from "@/components/ui-premium";
import { EmptyState } from "@/components/EmptyState";
import { PendenciaItemCard } from "@/components/tabs/PendenciaItemCard";

type ChipId = "atrasadas" | "hoje" | "semana" | "todas";

function classifyByDueDate(item: PendingItem, today: Date): ChipId | null {
  if (!item.dueDate) return null;
  const due = parseISO(item.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return "atrasadas";
  if (diff === 0) return "hoje";
  if (diff <= 7) return "semana";
  return null;
}

const Pendencias = () => {
  const { projectId } = useParams();
  const { sortedItems, stats, isLoading } = usePendencias({ projectId });
  const { paths } = useProjectNavigation();
  const [activeChip, setActiveChip] = useState<ChipId>("todas");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { todayCount, weekCount } = useMemo(() => {
    let todayC = 0;
    let weekC = 0;
    for (const item of sortedItems) {
      const bucket = classifyByDueDate(item, today);
      if (bucket === "hoje") todayC += 1;
      if (bucket === "hoje" || bucket === "semana") weekC += 1;
    }
    return { todayCount: todayC, weekCount: weekC };
  }, [sortedItems, today]);

  const filteredItems = useMemo(() => {
    if (activeChip === "todas") return sortedItems;
    return sortedItems.filter((item) => {
      const bucket = classifyByDueDate(item, today);
      if (activeChip === "atrasadas") return bucket === "atrasadas";
      if (activeChip === "hoje") return bucket === "hoje";
      if (activeChip === "semana") return bucket === "hoje" || bucket === "semana";
      return false;
    });
  }, [sortedItems, activeChip, today]);

  const getActionUrl = (item: PendingItem) => {
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
        <ProjectSubNav />
        <main className="py-6">
          <PageContainer maxWidth="xl">
            <PageSkeleton metrics content="cards" />
          </PageContainer>
        </main>
      </div>
    );
  }

  const summaryCardsDesktop = (
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

  const infoBannerDesktop = (
    <Alert className="border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-caption text-foreground/80">
        <strong>Importante:</strong> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
      </AlertDescription>
    </Alert>
  );

  const itemsList = (compact: boolean, items: PendingItem[]) => (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item, index) => (
        <PendenciaItemCard
          key={item.id}
          item={item}
          index={index}
          actionUrl={getActionUrl(item)}
          compact={compact}
        />
      ))}
      {items.length === 0 && (
        <div className="bg-card rounded-lg border border-border">
          <EmptyState
            icon={CheckCircle2}
            title={activeChip === "todas" ? "Tudo em dia" : "Nenhuma pendência neste filtro"}
            description={
              activeChip === "todas"
                ? "Não há pendências no momento."
                : "Tente outro recorte ou volte para Todas."
            }
          />
        </div>
      )}
    </div>
  );

  const mobileChips: SummaryChip[] = [
    { id: "atrasadas", label: "Atrasadas", count: stats.overdueCount, accent: "destructive" },
    { id: "hoje", label: "Hoje", count: todayCount, accent: "warning" },
    { id: "semana", label: "Esta semana", count: weekCount, accent: "warning" },
    { id: "todas", label: "Todas", count: stats.total, accent: "primary" },
  ];

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
      <ProjectSubNav />

      <main className="py-6">
        <PageContainer maxWidth="xl">
          {/* Desktop: Two-column layout (info banner kept here) */}
          <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
            <div className="space-y-4 sticky top-20 h-fit">
              <div className="space-y-2">
                {summaryCardsDesktop}
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
              {infoBannerDesktop}
            </div>
            {itemsList(false, sortedItems)}
          </div>

          {/* Mobile: SummaryChips + filtered list. Decorative info banner
              dropped on mobile to put the first item within one scroll. */}
          <div className="lg:hidden space-y-3">
            <SummaryChips
              ariaLabel="Filtrar pendências"
              chips={mobileChips}
              activeId={activeChip}
              onChange={(id) => setActiveChip((id as ChipId) ?? "todas")}
            />
            {itemsList(true, filteredItems)}
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Pendencias;
