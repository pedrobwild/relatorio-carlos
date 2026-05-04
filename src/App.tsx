import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, StaffRoute, CustomerRoute, AdminRoute } from "@/components/ProtectedRoute";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/queryClient";
import { createQueryPersister, QUERY_CACHE_VERSION } from "@/lib/queryPersister";
import { TabDiscardDetector } from "@/components/TabDiscardDetector";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { AppShell } from "@/components/layout/AppShell";
import { ConsentBanner } from "@/components/consent/ConsentBanner";

/** Thin wrapper: shows AuthRedirect (which navigates away) + a spinner while it resolves. */
const AuthRedirectPage = () => {
  return (
    <>
      <AuthRedirect />
      <RouteFallback />
    </>
  );
};

// Route-level code splitting: reduz bundle/memória inicial e diminui chance de "tab discard".
const Auth = lazy(() => import("./pages/Auth"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const VerificarAssinatura = lazy(() => import("./pages/VerificarAssinatura"));
const NotFound = lazy(() => import("./pages/NotFound"));

// GestaoObras (Portfólio antigo) foi descontinuado — /gestao redireciona para /gestao/painel-obras
const NovaObra = lazy(() => import("./pages/NovaObra"));
const EditarObra = lazy(() => import("./pages/EditarObra"));
const EditarObraWizard = lazy(() => import("./pages/EditarObraWizard"));
const Arquivos = lazy(() => import("./pages/Arquivos"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminAuditoria = lazy(() => import("./pages/AdminAuditoria"));
const AdminHealth = lazy(() => import("./pages/AdminHealth"));
const AdminUxInsights = lazy(() => import("./pages/AdminUxInsights"));
const Demo = lazy(() => import("./pages/Demo"));
const AdminResearch = lazy(() => import("./pages/AdminResearch"));
const CalendarioCompras = lazy(() => import("./pages/CalendarioCompras"));
const CalendarioObras = lazy(() => import("./pages/CalendarioObras"));
const Fornecedores = lazy(() => import("./pages/gestao/Fornecedores"));
const FornecedorDetalhe = lazy(() => import("./pages/gestao/FornecedorDetalhe"));
const FornecedoresAdmin = lazy(() => import("./pages/gestao/FornecedoresAdmin"));
const Orcamentos = lazy(() => import("./pages/gestao/Orcamentos"));
const CsOperacional = lazy(() => import("./pages/CsOperacional"));
const CsAnalytics = lazy(() => import("./pages/CsAnalytics"));
const CsTicketDetalhe = lazy(() => import("./pages/CsTicketDetalhe"));
const OrcamentoDetalhe = lazy(() => import("./pages/gestao/OrcamentoDetalhe"));
const NaoConformidadesGlobal = lazy(() => import("./pages/gestao/NaoConformidadesGlobal"));
const GestaoAtividades = lazy(() => import("./pages/GestaoAtividades"));
const PainelObras = lazy(() => import("./pages/PainelObras"));
const PainelAlertasCronograma = lazy(() => import("./pages/PainelAlertasCronograma"));
const Estoque = lazy(() => import("./pages/gestao/Estoque"));
const Lixeira = lazy(() => import("./pages/gestao/Lixeira"));

const Assistente = lazy(() => import("./pages/Assistente"));
const AssistenteConsultas = lazy(() => import("./pages/AssistenteConsultas"));
const AssistenteLogs = lazy(() => import("./pages/AssistenteLogs"));

const MinhasObras = lazy(() => import("./pages/MinhasObras"));


const Index = lazy(() => import("./pages/Index"));
const Contrato = lazy(() => import("./pages/Contrato"));
const Projeto3D = lazy(() => import("./pages/Projeto3D"));
const Executivo = lazy(() => import("./pages/Executivo"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Pendencias = lazy(() => import("./pages/Pendencias"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Formalizacoes = lazy(() => import("./pages/Formalizacoes"));
const FormalizacaoNova = lazy(() => import("./pages/FormalizacaoNova"));
const FormalizacaoDetalhe = lazy(() => import("./pages/FormalizacaoDetalhe"));
const Cronograma = lazy(() => import("./pages/Cronograma"));
const Compras = lazy(() => import("./pages/Compras"));
const Vistorias = lazy(() => import("./pages/Vistorias"));
const NaoConformidades = lazy(() => import("./pages/NaoConformidades"));
const AtividadesObra = lazy(() => import("./pages/AtividadesObra"));
const AtividadeDetalhe = lazy(() => import("./pages/AtividadeDetalhe"));
const JornadaProjeto = lazy(() => import("./pages/JornadaProjeto"));
const DadosCliente = lazy(() => import("./pages/DadosCliente"));
const OrcamentoProjeto = lazy(() => import("./pages/OrcamentoProjeto"));
const Assessor = lazy(() => import("./pages/Assessor"));

// Create persister - returns null if localStorage is not available
const persister = createQueryPersister();

// Cache max age: 24 hours
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Wrapper component to provide project context + project shell (variant=project).
const ProjectPage = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary name="ProjectPage" feature="general">
    <ProjectProvider>
      <AppShell variant="project">{children}</AppShell>
    </ProjectProvider>
  </ErrorBoundary>
);

// Wrapper for /gestao/* routes — single portfolio shell variant.
const PortfolioPage = ({ children }: { children: React.ReactNode }) => (
  <AppShell variant="portfolio">{children}</AppShell>
);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{node}</Suspense>
);

/**
 * Query Provider wrapper that uses PersistQueryClientProvider when 
 * persistence is available, otherwise falls back to standard QueryClientProvider.
 */
const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  if (persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE,
          buster: String(QUERY_CACHE_VERSION),
        }}
        onSuccess={() => {
          if (import.meta.env.DEV) {
            console.info('[QueryPersist] Cache restored from localStorage');
          }
        }}
        onError={() => {
          console.warn('[QueryPersist] Failed to restore cache, starting fresh');
          // Clear corrupted cache to prevent future errors
          try {
            localStorage.removeItem(`bwild-query-cache-v${QUERY_CACHE_VERSION}`);
          } catch {
            // Ignore cleanup errors
          }
        }}
      >
        {children}
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const App = () => (
  <ErrorBoundary name="AppRoot">
    <QueryProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <TabDiscardDetector />
        <BrowserRouter>
          <NetworkStatusBanner />
          <ConsentBanner />
          <a href="#main-content" className="skip-to-content">Pular para o conteúdo</a>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={withSuspense(<Auth />)} />
            <Route path="/recuperar-senha" element={withSuspense(<RecuperarSenha />)} />
            <Route path="/redefinir-senha" element={withSuspense(<RedefinirSenha />)} />
            <Route path="/verificar/:hash" element={withSuspense(<VerificarAssinatura />)} />
            
            {/* Staff-only routes — wrapped in AppShell variant=portfolio */}
            {/* /gestao foi unificada no Painel de Obras */}
            <Route path="/gestao" element={<Navigate to="/gestao/painel-obras" replace />} />
            <Route path="/gestao/nova-obra" element={<StaffRoute><PortfolioPage>{withSuspense(<NovaObra />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/obra/:projectId" element={<StaffRoute><PortfolioPage>{withSuspense(<EditarObra />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/obra/:projectId/wizard" element={<StaffRoute><PortfolioPage>{withSuspense(<EditarObraWizard />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/arquivos" element={<ProtectedRoute><PortfolioPage>{withSuspense(<Arquivos />)}</PortfolioPage></ProtectedRoute>} />
            <Route path="/gestao/calendario-compras" element={<StaffRoute><PortfolioPage>{withSuspense(<CalendarioCompras />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/estoque" element={<StaffRoute><PortfolioPage>{withSuspense(<Estoque />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/estoque/saidas" element={<Navigate to="/gestao/estoque?tab=saidas" replace />} />
            <Route path="/gestao/calendario-obras" element={<ProtectedRoute><PortfolioPage>{withSuspense(<CalendarioObras />)}</PortfolioPage></ProtectedRoute>} />
            <Route path="/gestao/fornecedores" element={<StaffRoute><PortfolioPage>{withSuspense(<Fornecedores />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/fornecedores/:id" element={<StaffRoute><PortfolioPage>{withSuspense(<FornecedorDetalhe />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/fornecedores/admin" element={<AdminRoute><PortfolioPage>{withSuspense(<FornecedoresAdmin />)}</PortfolioPage></AdminRoute>} />
            <Route path="/gestao/orcamentos" element={<StaffRoute><PortfolioPage>{withSuspense(<Orcamentos />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/orcamentos/:orcamentoId" element={<StaffRoute><PortfolioPage>{withSuspense(<OrcamentoDetalhe />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/nao-conformidades" element={<StaffRoute><PortfolioPage>{withSuspense(<NaoConformidadesGlobal />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/atividades" element={<StaffRoute><PortfolioPage>{withSuspense(<GestaoAtividades />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/assistente" element={<StaffRoute><PortfolioPage>{withSuspense(<Assistente />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/assistente/consultas" element={<StaffRoute><PortfolioPage>{withSuspense(<AssistenteConsultas />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/assistente/logs" element={<AdminRoute><PortfolioPage>{withSuspense(<AssistenteLogs />)}</PortfolioPage></AdminRoute>} />
            <Route path="/gestao/painel-obras" element={<StaffRoute><PortfolioPage>{withSuspense(<PainelObras />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/alertas-cronograma" element={<StaffRoute><PortfolioPage>{withSuspense(<PainelAlertasCronograma />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/lixeira" element={<StaffRoute><PortfolioPage>{withSuspense(<Lixeira />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/cs" element={<Navigate to="/gestao/cs/operacional" replace />} />
            <Route path="/gestao/cs/operacional" element={<StaffRoute><PortfolioPage>{withSuspense(<CsOperacional />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/cs/analytics" element={<StaffRoute><PortfolioPage>{withSuspense(<CsAnalytics />)}</PortfolioPage></StaffRoute>} />
            <Route path="/gestao/cs/:ticketId" element={<StaffRoute><PortfolioPage>{withSuspense(<CsTicketDetalhe />)}</PortfolioPage></StaffRoute>} />
            <Route path="/arquivos" element={<ProtectedRoute>{withSuspense(<Arquivos />)}</ProtectedRoute>} />
            
            {/* Admin-only routes */}
            <Route path="/admin" element={<AdminRoute>{withSuspense(<Admin />)}</AdminRoute>} />
            <Route path="/admin/auditoria" element={<AdminRoute>{withSuspense(<AdminAuditoria />)}</AdminRoute>} />
            <Route path="/admin/health" element={<AdminRoute>{withSuspense(<AdminHealth />)}</AdminRoute>} />
            <Route path="/admin/ux-insights" element={<AdminRoute>{withSuspense(<AdminUxInsights />)}</AdminRoute>} />
            <Route path="/admin/research" element={<AdminRoute>{withSuspense(<AdminResearch />)}</AdminRoute>} />
            <Route path="/demo" element={<AdminRoute>{withSuspense(<Demo />)}</AdminRoute>} />
            
            {/* Customer-only routes */}
            <Route path="/minhas-obras" element={<CustomerRoute>{withSuspense(<MinhasObras />)}</CustomerRoute>} />
            
            {/* Project-scoped routes (both staff and customer with project access) */}
            <Route
              path="/obra/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Index />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/relatorio"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Index />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/jornada"
              element={
                <ProtectedRoute>
                   <ProjectPage>{withSuspense(<JornadaProjeto />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/contrato"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Contrato />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/projeto-3d"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Projeto3D />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/executivo"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Executivo />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/financeiro"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Financeiro />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/pendencias"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Pendencias />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/documentos"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Documentos />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/formalizacoes"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Formalizacoes />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/formalizacoes/nova"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<FormalizacaoNova />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/formalizacoes/:id"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<FormalizacaoDetalhe />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/cronograma"
              element={
                <ProtectedRoute>
                  <ProjectPage>{withSuspense(<Cronograma />)}</ProjectPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/obra/:projectId/compras"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<Compras />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/vistorias"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<Vistorias />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/nao-conformidades"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<NaoConformidades />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/dados-cliente"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<DadosCliente />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/atividades"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<AtividadesObra />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/atividades/:taskId"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<AtividadeDetalhe />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/orcamento"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<OrcamentoProjeto />)}</ProjectPage>
                </StaffRoute>
              }
            />
            <Route
              path="/obra/:projectId/assessor"
              element={
                <StaffRoute>
                  <ProjectPage>{withSuspense(<Assessor />)}</ProjectPage>
                </StaffRoute>
              }
            />

            {/* Root route - redirect based on role */}
            <Route path="/" element={<ProtectedRoute><AuthRedirectPage /></ProtectedRoute>} />
            <Route path="/relatorio" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/contrato" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/projeto-3d" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/executivo" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/financeiro" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/pendencias" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/formalizacoes" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/formalizacoes/nova" element={<Navigate to="/minhas-obras" replace />} />
            <Route path="/formalizacoes/:id" element={<Navigate to="/minhas-obras" replace />} />
            
            {/* Catch-all */}
            <Route path="*" element={withSuspense(<NotFound />)} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryProvider>
  </ErrorBoundary>
);

export default App;
