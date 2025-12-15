import { useMemo } from "react";
import { parseISO, differenceInDays } from "date-fns";

export type PendingType = "decision" | "invoice" | "signature" | "approval_3d" | "approval_exec";
export type PendingPriority = "alta" | "média" | "baixa";
export type PendingStatus = "pendente" | "urgente" | "atrasado";

export interface PendingItem {
  id: string;
  type: PendingType;
  title: string;
  description: string;
  dueDate: string;
  priority: PendingPriority;
  impact?: string;
  options?: string[];
  amount?: number;
}

// Demo date - in production this would be new Date()
export const DEMO_DATE = new Date("2025-09-08");

// Sample data for demo
export const pendingItemsData: PendingItem[] = [
  // Client Decisions
  {
    id: "dec-1",
    type: "decision",
    title: "Posição do suporte articulado de TV 65\"",
    description: "Definir altura e posição do suporte na parede da sala",
    dueDate: "2025-09-09",
    priority: "alta",
    impact: "Atraso na instalação elétrica embutida e possível retrabalho no gesso/pintura",
    options: ["Altura 1,10m centralizado", "Altura 1,10m deslocado 15cm esquerda", "Altura 1,20m centralizado"],
  },
  {
    id: "dec-2",
    type: "decision",
    title: "Aprovar torneira alternativa para banheiro social",
    description: "Modelo Docol Bistro Cromado (original Deca Polo indisponível até 20/09)",
    dueDate: "2025-09-10",
    priority: "média",
    impact: "Atraso de 12 dias se aguardar modelo original",
  },
  // Overdue Invoice
  {
    id: "inv-1",
    type: "invoice",
    title: "Parcela 6 - Marcenaria",
    description: "Vencimento original: 05/09/2025",
    dueDate: "2025-09-05",
    priority: "alta",
    amount: 28500,
  },
  // Upcoming Invoice
  {
    id: "inv-2",
    type: "invoice",
    title: "Parcela 7 - Instalações e acabamentos",
    description: "Próximo vencimento",
    dueDate: "2025-09-12",
    priority: "média",
    amount: 15200,
  },
  // Pending Signatures
  {
    id: "sig-1",
    type: "signature",
    title: "Aditivo de Contrato - Julho",
    description: "Inclusão de marcenaria adicional no hall de entrada",
    dueDate: "2025-09-08",
    priority: "alta",
    impact: "Pendente de assinatura para formalização do serviço adicional",
  },
  {
    id: "sig-2",
    type: "signature",
    title: "Ata de Reunião - Semana 9",
    description: "Definições sobre instalação de coifa e eletros",
    dueDate: "2025-09-10",
    priority: "baixa",
  },
  // 3D Project Approval
  {
    id: "3d-1",
    type: "approval_3d",
    title: "Aprovação do Projeto 3D - Cozinha",
    description: "Renderização final com ajustes de iluminação solicitados",
    dueDate: "2025-09-11",
    priority: "média",
    impact: "Liberação para produção de peças de marcenaria customizadas",
  },
  // Executive Project Approval
  {
    id: "exec-1",
    type: "approval_exec",
    title: "Aprovação do Projeto Executivo - Elétrica",
    description: "Planta baixa com pontos elétricos e circuitos dedicados",
    dueDate: "2025-09-07",
    priority: "alta",
    impact: "Execução da instalação elétrica já iniciada - aprovação retroativa necessária",
  },
];

export const getStatus = (dueDate: string, referenceDate: Date = DEMO_DATE): PendingStatus => {
  const due = parseISO(dueDate);
  const diff = differenceInDays(due, referenceDate);
  
  if (diff < 0) return "atrasado";
  if (diff <= 2) return "urgente";
  return "pendente";
};

export const usePendencias = () => {
  const pendingItems = pendingItemsData;

  const stats = useMemo(() => {
    const total = pendingItems.length;
    const overdueCount = pendingItems.filter(item => getStatus(item.dueDate) === "atrasado").length;
    const urgentCount = pendingItems.filter(item => getStatus(item.dueDate) === "urgente").length;
    const pendingCount = pendingItems.filter(item => getStatus(item.dueDate) === "pendente").length;
    
    // Count by type
    const byType = {
      decision: pendingItems.filter(item => item.type === "decision").length,
      invoice: pendingItems.filter(item => item.type === "invoice").length,
      signature: pendingItems.filter(item => item.type === "signature").length,
      approval_3d: pendingItems.filter(item => item.type === "approval_3d").length,
      approval_exec: pendingItems.filter(item => item.type === "approval_exec").length,
    };

    return {
      total,
      overdueCount,
      urgentCount,
      pendingCount,
      byType,
      hasUrgent: overdueCount > 0 || urgentCount > 0,
    };
  }, [pendingItems]);

  const sortedItems = useMemo(() => {
    return [...pendingItems].sort((a, b) => {
      const statusOrder = { atrasado: 0, urgente: 1, pendente: 2 };
      const statusA = getStatus(a.dueDate);
      const statusB = getStatus(b.dueDate);
      if (statusOrder[statusA] !== statusOrder[statusB]) {
        return statusOrder[statusA] - statusOrder[statusB];
      }
      return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
    });
  }, [pendingItems]);

  return {
    pendingItems,
    sortedItems,
    stats,
  };
};
