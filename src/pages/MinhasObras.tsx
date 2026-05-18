import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { useClientDashboard } from "@/hooks/useClientDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardActivities } from "@/hooks/useDashboardActivities";
import { DashboardStatsCards } from "@/pages/minhas-obras/DashboardStatsCards";
import { UpcomingPaymentsCard } from "@/pages/minhas-obras/UpcomingPaymentsCard";
import { ProjectDashboardCard } from "@/pages/minhas-obras/ProjectDashboardCard";
import { NextActionsBlock } from "@/components/cockpit/NextActionsBlock";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { buildSupportWhatsappUrl } from "@/config/contact";
import { differenceInDays, parseISO } from "date-fns";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

/** Saudação contextual por horário — reduz fricção emocional na entrada. */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Detecta se há pagamento urgente (≤ 2 dias) — promove o card no mobile. */
function hasUrgentPayment(payments: Array<{ due_date: string }>): boolean {
  return payments.some((p) => {
    if (!p.due_date) return false;
    const parsed = parseISO(p.due_date);
    if (Number.isNaN(parsed.getTime())) return false;
    const diff = differenceInDays(parsed, new Date());
    return diff <= 2 && diff >= -1;
  });
}

/**
 * Ordem de prioridade dos status — definida em escopo de módulo para que
 * a referência seja estável entre renders e o `useMemo` do `sortedProjects`
 * não pague o custo de realocar este objeto a cada execução.
 */
const STATUS_ORDER: Record<string, number> = {
  active: 0,
  paused: 1,
  completed: 2,
  cancelled: 3,
};

export default function MinhasObras() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, stats, upcomingPayments, isLoading, error } =
    useClientDashboard();
  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "";
  const firstName = displayName.split(" ")[0];
  const activeIds = useMemo(
    () => projects.filter((p) => p.status === "active").map((p) => p.id),
    [projects],
  );
  const { data: activitiesMap } = useDashboardActivities(activeIds);
  const getProjectActivities = useCallback(
    (projectId: string) =>
      activitiesMap instanceof Map ? activitiesMap.get(projectId) : undefined,
    [activitiesMap],
  );

  const handleProjectClick = useCallback(
    (project: ProjectSummary) => {
      sessionStorage.setItem("selectedProjectId", project.id);
      navigate(`/obra/${project.id}`);
    },
    [navigate],
  );

  const handlePaymentClick = useCallback(
    (projectId: string) => {
      sessionStorage.setItem("selectedProjectId", projectId);
      navigate(`/obra/${projectId}?tab=financeiro`);
    },
    [navigate],
  );

  // Ordenação memoizada: ativos primeiro, depois por progresso desc.
  // STATUS_ORDER vive fora do componente (módulo) para não realocar a cada
  // render. A dependência única é `projects`; sem mudança de referência,
  // mantemos a mesma instância e evitamos re-renders dos filhos memoizados.
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const statusDiff =
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return (b.progress_percentage || 0) - (a.progress_percentage || 0);
    });
  }, [projects]);

  const hasMultipleProjects = projects.length > 1;

  // Em mobile, se há vencimento urgente, promovemos o card de pagamentos
  // ANTES da lista (info financeira acima da dobra — best practice mobile UX).
  // Memoizamos para evitar recomputar `hasUrgentPayment` (parseISO + Date.now
  // por item) a cada render e estabilizar a className condicional do bloco
  // que depende disso — preservando a identidade do nó e evitando reflows.
  const promotePaymentsOnMobile = useMemo(
    () => upcomingPayments.length > 0 && hasUrgentPayment(upcomingPayments),
    [upcomingPayments],
  );

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-primary/5 via-background to-background pb-safe pl-safe pr-safe">
      <AppHeader>
        <div className="ml-2 min-w-0">
          <h1 className="text-h3 font-bold truncate">Portal do Cliente</h1>
        </div>
      </AppHeader>

      <main className="py-4 sm:py-6">
        <PageContainer maxWidth="md">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-h2 font-bold mb-1">
              {firstName ? `${getGreeting()}, ${firstName}` : "Meu Painel"}
            </h2>
            <p className="text-caption text-muted-foreground">
              Visão geral dos seus projetos e ações pendentes
            </p>
          </div>

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="h-14 bg-muted animate-pulse rounded-lg" />
                    </Card>
                  ))}
                </div>
                <ContentSkeleton variant="list" rows={3} />
              </div>
            ) : error ? (
              <Card className="p-6 text-center space-y-3">
                <p className="text-body text-foreground">
                  Não foi possível carregar seus projetos agora.
                </p>
                <p className="text-caption text-muted-foreground">
                  Verifique sua conexão e tente novamente.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition"
                >
                  Tentar novamente
                </button>
              </Card>
            ) : sortedProjects.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={
                  displayName
                    ? `Olá, ${displayName}! Sua jornada começa aqui.`
                    : "Sua jornada começa aqui"
                }
                description="Sua primeira obra será exibida aqui assim que nosso time iniciar o projeto. Você receberá um e-mail de confirmação com os próximos passos."
                hint="Se você já recebeu um convite por e-mail, verifique se está logado com o mesmo endereço de e-mail."
                action={{
                  label: "Falar no WhatsApp",
                  onClick: () =>
                    window.open(
                      buildSupportWhatsappUrl({
                        reason: "Ainda não consigo ver minha obra no portal.",
                        userName: displayName || null,
                        userEmail: user?.email ?? null,
                      }),
                      "_blank",
                      "noopener,noreferrer",
                    ),
                  icon: MessageCircle,
                }}
                secondaryAction={{
                  label: "Enviar e-mail",
                  onClick: () =>
                    window.open("mailto:contato@bwild.com.br", "_blank"),
                }}
              />
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {/* Cockpit "Ação necessária" — sempre acima dos stats/projetos */}
                <ErrorBoundary
                  name="NextActionsBlock"
                  feature="general"
                  fallback={null}
                >
                  <NextActionsBlock />
                </ErrorBoundary>

                {/* Pagamento urgente → promovido no mobile (acima da dobra) */}
                {promotePaymentsOnMobile && (
                  <div className="lg:hidden">
                    <ErrorBoundary
                      name="UpcomingPaymentsMobile"
                      feature="general"
                      fallback={null}
                    >
                      <UpcomingPaymentsCard
                        payments={upcomingPayments}
                        onPaymentClick={handlePaymentClick}
                      />
                    </ErrorBoundary>
                  </div>
                )}

                {/* Stats Cards - only show if multiple projects for a richer overview */}
                {hasMultipleProjects && <DashboardStatsCards stats={stats} />}

                {/* Main layout: projects list + sidebar */}
                <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1fr_280px]">
                  {/* Projects List */}
                  <div className="space-y-3">
                    <h3 className="text-caption font-semibold text-muted-foreground uppercase tracking-wider">
                      {hasMultipleProjects ? "Meus Projetos" : "Meu Projeto"}
                    </h3>
                    {sortedProjects.map((project) => (
                      <ErrorBoundary
                        key={project.id}
                        name={`ProjectCard-${project.id}`}
                        feature="general"
                        fallback={
                          <Card className="p-4 border-destructive/20">
                            <p className="text-sm text-muted-foreground">
                              Erro ao exibir projeto.{" "}
                              <button
                                className="underline text-primary min-h-11 inline-flex items-center"
                                onClick={() => handleProjectClick(project)}
                              >
                                Abrir mesmo assim
                              </button>
                            </p>
                          </Card>
                        }
                      >
                        <ProjectDashboardCard
                          project={project}
                          onClick={() => handleProjectClick(project)}
                          activities={getProjectActivities(project.id)}
                        />
                      </ErrorBoundary>
                    ))}
                  </div>

                  {/* Sidebar (desktop) ou rodapé (mobile sem urgência) */}
                  {upcomingPayments.length > 0 && (
                    <div
                      className={
                        promotePaymentsOnMobile ? "hidden lg:block" : ""
                      }
                    >
                      <ErrorBoundary
                        name="UpcomingPayments"
                        feature="general"
                        fallback={null}
                      >
                        <UpcomingPaymentsCard
                          payments={upcomingPayments}
                          onPaymentClick={handlePaymentClick}
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
