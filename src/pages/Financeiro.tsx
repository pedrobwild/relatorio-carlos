import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProject } from "@/contexts/ProjectContext";
import {
  useProjectPayments,
  useMarkPaymentPaid,
  ProjectPayment,
} from "@/hooks/useProjectPayments";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { EmptyState } from "@/components/EmptyState";
import { FinancialSummary } from "./financeiro/FinancialSummary";
import {
  DesktopPaymentCard,
  MobilePaymentCard,
} from "./financeiro/PaymentCard";

const Financeiro = () => {
  const { project, loading: projectLoading } = useProject();
  const { data: payments = [], isLoading: paymentsLoading } =
    useProjectPayments(project?.id);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const markPaidMutation = useMarkPaymentPaid();
  const { paths } = useProjectNavigation();

  const totalValue =
    project?.contract_value ?? payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments
    .filter((p) => p.paid_at)
    .reduce((sum, p) => sum + p.amount, 0);
  const unpaidAmount = payments
    .filter((p) => !p.paid_at)
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = unpaidAmount;
  const paidCount = payments.filter((p) => p.paid_at).length;

  const handleTogglePaid = (payment: ProjectPayment) => {
    markPaidMutation.mutate({ paymentId: payment.id, paid: !payment.paid_at });
  };

  const isLoading = projectLoading || paymentsLoading || roleLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="flex-1 max-w-5xl mx-auto w-full p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
        <PageHeader
          title="Financeiro"
          backTo={paths.relatorio}
          breadcrumbs={[
            { label: "Minhas Obras", href: "/minhas-obras" },
            { label: project?.name || "Obra", href: paths.relatorio },
            { label: "Financeiro" },
          ]}
        />
        <ProjectSubNav />

        <div className="flex-1 max-w-5xl mx-auto w-full">
          {payments.length === 0 ? (
            <EmptyState
              variant="payments"
              title="Nenhum pagamento programado"
              description="Assim que o cronograma financeiro for definido, as parcelas e boletos aparecerão aqui automaticamente."
              hint="Fique tranquilo — você será notificado quando houver um pagamento próximo do vencimento."
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:grid md:grid-cols-[1fr_1.5fr] md:divide-x md:divide-border">
                <FinancialSummary
                  totalValue={totalValue}
                  paidAmount={paidAmount}
                  remainingAmount={remainingAmount}
                  paidCount={paidCount}
                  totalCount={payments.length}
                  isAdmin={isAdmin}
                  variant="desktop"
                />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-h2">Histórico de Parcelas</h2>
                    {isAdmin && (
                      <Badge variant="outline" className="text-xs">
                        Admin: pode editar
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <DesktopPaymentCard
                        key={payment.id}
                        payment={payment}
                        isAdmin={isAdmin}
                        projectId={project.id}
                        onTogglePaid={handleTogglePaid}
                        isPending={markPaidMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div className="md:hidden">
                <FinancialSummary
                  totalValue={totalValue}
                  paidAmount={paidAmount}
                  remainingAmount={remainingAmount}
                  paidCount={paidCount}
                  totalCount={payments.length}
                  isAdmin={isAdmin}
                  variant="mobile"
                />
                <div className="divide-y divide-border">
                  {payments.map((payment) => (
                    <MobilePaymentCard
                      key={payment.id}
                      payment={payment}
                      isAdmin={isAdmin}
                      projectId={project.id}
                      onTogglePaid={handleTogglePaid}
                      isPending={markPaidMutation.isPending}
                    />
                  ))}
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-caption">
                    Última atualização:{" "}
                    {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Financeiro;
