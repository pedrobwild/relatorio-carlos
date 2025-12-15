import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import VerificarAssinatura from "./pages/VerificarAssinatura";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/relatorio" element={<Index />} />
          <Route path="/contrato" element={<Contrato />} />
          <Route path="/projeto-3d" element={<Projeto3D />} />
          <Route path="/executivo" element={<Executivo />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/pendencias" element={<Pendencias />} />
          <Route path="/formalizacoes" element={<Formalizacoes />} />
          <Route path="/formalizacoes/nova" element={<FormalizacaoNova />} />
          <Route path="/formalizacoes/:id" element={<FormalizacaoDetalhe />} />
          <Route path="/verificar/:hash" element={<VerificarAssinatura />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
