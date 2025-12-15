import { useMemo } from "react";
import { parseISO, differenceInDays, addDays } from "date-fns";

export type PendingType = "decision" | "invoice" | "signature" | "approval_3d" | "approval_exec";
export type PendingPriority = "alta" | "média" | "baixa";
export type PendingStatus = "pendente" | "urgente" | "atrasado";

export interface PendingItem {
  id: string;
  type: PendingType;
  title: string;
  description: string;
  dueDate: string; // Data limite para ação
  createdDate: string; // Data de criação/envio da pendência
  priority: PendingPriority;
  impact?: string;
  options?: string[];
  amount?: number;
}

// Prazos por tipo de pendência (em dias)
export const DEADLINE_BY_TYPE: Record<PendingType, number> = {
  decision: 0, // Decisões usam prazo específico do item
  invoice: 0, // Faturas usam data de vencimento
  signature: 5, // Aditivos e formalizações: 5 dias
  approval_3d: 2, // Projeto 3D: 2 dias
  approval_exec: 2, // Projeto Executivo: 2 dias
};

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
    createdDate: "2025-09-05",
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
    createdDate: "2025-09-06",
    dueDate: "2025-09-10",
    priority: "média",
    impact: "Atraso de 12 dias se aguardar modelo original",
  },
  // Overdue Invoice
  {
    id: "inv-1",
    type: "invoice",
    title: "Parcela 6 - 45 dias após início da obra",
    description: "Vencimento original: 05/09/2025",
    createdDate: "2025-08-25",
    dueDate: "2025-09-05",
    priority: "alta",
    amount: 28500,
  },
  // Upcoming Invoice
  {
    id: "inv-2",
    type: "invoice",
    title: "Parcela 7 - 60 dias após início da obra",
    description: "Próximo vencimento",
    createdDate: "2025-09-01",
    dueDate: "2025-09-12",
    priority: "média",
    amount: 15200,
  },
  // Pending Signatures - Aditivo enviado 03/09, prazo 5 dias = vence 08/09
  {
    id: "sig-1",
    type: "signature",
    title: "Aditivo de Contrato - Julho",
    description: "Inclusão de marcenaria adicional no hall de entrada",
    createdDate: "2025-09-03",
    dueDate: "2025-09-08", // 5 dias após criação
    priority: "alta",
    impact: "Pendente de assinatura para formalização do serviço adicional",
  },
  // Ata enviada 05/09, prazo 5 dias = vence 10/09
  {
    id: "sig-2",
    type: "signature",
    title: "Ata de Reunião - Semana 9",
    description: "Definições sobre instalação de coifa e eletros",
    createdDate: "2025-09-05",
    dueDate: "2025-09-10", // 5 dias após criação
    priority: "baixa",
  },
  // 3D Project Approval - enviado 07/09, prazo 2 dias = vence 09/09
  {
    id: "3d-1",
    type: "approval_3d",
    title: "Aprovação do Projeto 3D - Cozinha",
    description: "Renderização final com ajustes de iluminação solicitados",
    createdDate: "2025-09-07",
    dueDate: "2025-09-09", // 2 dias após criação
    priority: "média",
    impact: "Liberação para produção de peças de marcenaria customizadas",
  },
  // Executive Project Approval - enviado 04/09, prazo 2 dias = venceu 06/09
  {
    id: "exec-1",
    type: "approval_exec",
    title: "Aprovação do Projeto Executivo - Elétrica",
    description: "Planta baixa com pontos elétricos e circuitos dedicados",
    createdDate: "2025-09-04",
    dueDate: "2025-09-06", // 2 dias após criação - já venceu
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

// Calcula quantos dias está atrasado em relação ao prazo do tipo
export const getDaysOverdue = (item: PendingItem, referenceDate: Date = DEMO_DATE): number => {
  const due = parseISO(item.dueDate);
  const diff = differenceInDays(referenceDate, due);
  return diff > 0 ? diff : 0;
};

// Calcula dias restantes até o vencimento
export const getDaysRemaining = (item: PendingItem, referenceDate: Date = DEMO_DATE): number => {
  const due = parseISO(item.dueDate);
  const diff = differenceInDays(due, referenceDate);
  return diff;
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
