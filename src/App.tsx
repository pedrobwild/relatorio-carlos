import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, StaffRoute, CustomerRoute } from "@/components/ProtectedRoute";
import { ProjectProvider } from "@/contexts/ProjectContext";

// Public pages
import Auth from "./pages/Auth";
import VerificarAssinatura from "./pages/VerificarAssinatura";
import NotFound from "./pages/NotFound";

// Staff pages
import GestaoObras from "./pages/GestaoObras";
import NovaObra from "./pages/NovaObra";

// Customer pages
import MinhasObras from "./pages/MinhasObras";

// Shared pages (accessible by both with project context)
import Home from "./pages/Home";
import Index from "./pages/Index";
import Contrato from "./pages/Contrato";
import Projeto3D from "./pages/Projeto3D";
import Executivo from "./pages/Executivo";
import Financeiro from "./pages/Financeiro";
import Pendencias from "./pages/Pendencias";
import Documentos from "./pages/Documentos";
import Formalizacoes from "./pages/Formalizacoes";
import FormalizacaoNova from "./pages/FormalizacaoNova";
import FormalizacaoDetalhe from "./pages/FormalizacaoDetalhe";

const queryClient = new QueryClient();

// Wrapper component to provide project context
const ProjectPage = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/verificar/:hash" element={<VerificarAssinatura />} />
          
          {/* Staff-only routes */}
          <Route path="/gestao" element={<StaffRoute><GestaoObras /></StaffRoute>} />
          <Route path="/gestao/nova-obra" element={<StaffRoute><NovaObra /></StaffRoute>} />
          
          {/* Customer-only routes */}
          <Route path="/minhas-obras" element={<CustomerRoute><MinhasObras /></CustomerRoute>} />
          
          {/* Project-scoped routes (both staff and customer with project access) */}
          <Route path="/obra/:projectId" element={<ProtectedRoute><ProjectPage><Index /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/relatorio" element={<ProtectedRoute><ProjectPage><Index /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/contrato" element={<ProtectedRoute><ProjectPage><Contrato /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/projeto-3d" element={<ProtectedRoute><ProjectPage><Projeto3D /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/executivo" element={<ProtectedRoute><ProjectPage><Executivo /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/financeiro" element={<ProtectedRoute><ProjectPage><Financeiro /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/pendencias" element={<ProtectedRoute><ProjectPage><Pendencias /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/documentos" element={<ProtectedRoute><ProjectPage><Documentos /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/formalizacoes" element={<ProtectedRoute><ProjectPage><Formalizacoes /></ProjectPage></ProtectedRoute>} />
          <Route path="/obra/:projectId/formalizacoes/nova" element={<StaffRoute><ProjectPage><FormalizacaoNova /></ProjectPage></StaffRoute>} />
          <Route path="/obra/:projectId/formalizacoes/:id" element={<ProtectedRoute><ProjectPage><FormalizacaoDetalhe /></ProjectPage></ProtectedRoute>} />
          
          {/* Legacy routes - redirect to appropriate pages */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
