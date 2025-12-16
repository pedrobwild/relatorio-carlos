import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, StaffRoute, CustomerRoute } from "@/components/ProtectedRoute";

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
import Formalizacoes from "./pages/Formalizacoes";
import FormalizacaoNova from "./pages/FormalizacaoNova";
import FormalizacaoDetalhe from "./pages/FormalizacaoDetalhe";

const queryClient = new QueryClient();

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
          
          {/* Protected routes (both staff and customer with project context) */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/relatorio" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/obra/:projectId" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/contrato" element={<ProtectedRoute><Contrato /></ProtectedRoute>} />
          <Route path="/projeto-3d" element={<ProtectedRoute><Projeto3D /></ProtectedRoute>} />
          <Route path="/executivo" element={<ProtectedRoute><Executivo /></ProtectedRoute>} />
          <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
          <Route path="/pendencias" element={<ProtectedRoute><Pendencias /></ProtectedRoute>} />
          <Route path="/formalizacoes" element={<ProtectedRoute><Formalizacoes /></ProtectedRoute>} />
          <Route path="/formalizacoes/nova" element={<StaffRoute><FormalizacaoNova /></StaffRoute>} />
          <Route path="/formalizacoes/:id" element={<ProtectedRoute><FormalizacaoDetalhe /></ProtectedRoute>} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
