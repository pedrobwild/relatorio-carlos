import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, StaffRoute, CustomerRoute, AdminRoute } from "@/components/ProtectedRoute";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/queryClient";
import { TabDiscardDetector } from "@/components/TabDiscardDetector";

// Route-level code splitting: reduz bundle/memória inicial e diminui chance de “tab discard”.
const Auth = lazy(() => import("./pages/Auth"));
const VerificarAssinatura = lazy(() => import("./pages/VerificarAssinatura"));
const NotFound = lazy(() => import("./pages/NotFound"));

const GestaoObras = lazy(() => import("./pages/GestaoObras"));
const NovaObra = lazy(() => import("./pages/NovaObra"));
const EditarObra = lazy(() => import("./pages/EditarObra"));
const Admin = lazy(() => import("./pages/Admin"));
const Demo = lazy(() => import("./pages/Demo"));

const MinhasObras = lazy(() => import("./pages/MinhasObras"));

const Home = lazy(() => import("./pages/Home"));
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

// Wrapper component to provide project context
const ProjectPage = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{node}</Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <TabDiscardDetector />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={withSuspense(<Auth />)} />
            <Route path="/verificar/:hash" element={withSuspense(<VerificarAssinatura />)} />
            
            {/* Staff-only routes */}
            <Route path="/gestao" element={<StaffRoute>{withSuspense(<GestaoObras />)}</StaffRoute>} />
            <Route path="/gestao/nova-obra" element={<StaffRoute>{withSuspense(<NovaObra />)}</StaffRoute>} />
            <Route path="/gestao/obra/:projectId" element={<StaffRoute>{withSuspense(<EditarObra />)}</StaffRoute>} />
            
            {/* Admin-only routes */}
            <Route path="/admin" element={<AdminRoute>{withSuspense(<Admin />)}</AdminRoute>} />
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
                <StaffRoute>
                  <ProjectPage>{withSuspense(<Cronograma />)}</ProjectPage>
                </StaffRoute>
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
            
            {/* Legacy routes - redirect to appropriate pages */}
            <Route path="/" element={<ProtectedRoute>{withSuspense(<Home />)}</ProtectedRoute>} />
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
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
