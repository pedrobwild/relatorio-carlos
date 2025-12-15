import { useMemo } from "react";
import { parseISO, differenceInDays, addDays, format } from "date-fns";
import { week10SeedData } from "@/data/week10SeedData";
import { formalizacoesSeedData } from "@/data/formalizacoesSeedData";

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

// Helper to add business days
const addBusinessDays = (date: Date, days: number): Date => {
  let result = new Date(date);
  let added = 0;
  while (added < days) {
    result = addDays(result, 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

// Generate pending items from real data sources
const generatePendingItems = (): PendingItem[] => {
  const items: PendingItem[] = [];

  // 1. CLIENT DECISIONS from week10SeedData
  week10SeedData.clientDecisions?.forEach((decision) => {
    if (decision.status === "pending") {
      items.push({
        id: `dec-${decision.id}`,
        type: "decision",
        title: decision.description.length > 60 
          ? decision.description.substring(0, 60) + "..." 
          : decision.description,
        description: decision.description,
        createdDate: week10SeedData.periodStart,
        dueDate: decision.dueDate,
        priority: "alta",
        impact: decision.impactIfDelayed,
        options: decision.options,
      });
    }
  });

  // 2. INVOICES from Financeiro data (matching Financeiro.tsx logic)
  const contractSignatureDate = new Date(2025, 5, 17); // 17/06/2025
  const constructionStartDate = new Date(2025, 6, 1); // 01/07/2025
  const projectEndDate = new Date(2025, 8, 14); // 14/09/2025

  const installments = [
    {
      id: 1,
      stage: "Assinatura do Contrato",
      amount: 11000,
      dueDate: addBusinessDays(contractSignatureDate, 2),
      status: "paid" as const,
    },
    {
      id: 2,
      stage: "Início da Obra",
      amount: 29333.33,
      dueDate: addBusinessDays(constructionStartDate, 2),
      status: "paid" as const,
    },
    {
      id: 3,
      stage: "25 dias corridos após início da obra",
      amount: 29333.33,
      dueDate: addBusinessDays(addDays(constructionStartDate, 25), 2),
      status: "paid" as const,
    },
    {
      id: 4,
      stage: "45 dias corridos após início da obra",
      amount: 29333.34,
      dueDate: addBusinessDays(addDays(constructionStartDate, 45), 2),
      status: "pending" as const,
    },
    {
      id: 5,
      stage: "Assinatura do Termo de Entrega",
      amount: 11000,
      dueDate: addBusinessDays(projectEndDate, 2),
      status: "upcoming" as const,
    },
  ];

  installments.forEach((inst) => {
    if (inst.status === "pending" || inst.status === "upcoming") {
      const daysUntilDue = differenceInDays(inst.dueDate, DEMO_DATE);
      // Only add if due within 14 days for upcoming, or any pending
      if (inst.status === "pending" || daysUntilDue <= 14) {
        items.push({
          id: `inv-${inst.id}`,
          type: "invoice",
          title: `Parcela ${inst.id} - ${inst.stage}`,
          description: `Vencimento: ${format(inst.dueDate, "dd/MM/yyyy")}`,
          createdDate: format(addDays(inst.dueDate, -10), "yyyy-MM-dd"),
          dueDate: format(inst.dueDate, "yyyy-MM-dd"),
          priority: daysUntilDue < 0 ? "alta" : daysUntilDue <= 5 ? "média" : "baixa",
          amount: inst.amount,
        });
      }
    }
  });

  // 3. FORMALIZATION SIGNATURES from formalizacoesSeedData
  formalizacoesSeedData.forEach((form) => {
    // Only include if pending_signatures and customer hasn't signed
    if (form.status === "pending_signatures") {
      const parties = form.parties as any[] | null;
      const acknowledgements = form.acknowledgements as any[] | null;
      
      // Find customer party
      const customerParty = parties?.find(p => p.party_type === "customer" && p.must_sign === true);
      
      if (customerParty) {
        // Check if customer has already acknowledged
        const customerAck = acknowledgements?.find(a => a.party_id === customerParty.id && a.acknowledged);
        
        if (!customerAck) {
          // Customer hasn't signed yet
          const lockedAt = form.locked_at ? parseISO(form.locked_at) : null;
          const dueDate = lockedAt ? addBusinessDays(lockedAt, 5) : null;
          
          items.push({
            id: `sig-${form.id?.substring(0, 8)}`,
            type: "signature",
            title: form.title || "Formalização",
            description: form.summary || "",
            createdDate: form.created_at || "",
            dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : form.updated_at?.split("T")[0] || "",
            priority: "alta",
            impact: "Pendente de assinatura para formalização",
          });
        }
      }
    }
  });

  return items;
};

export const pendingItemsData: PendingItem[] = generatePendingItems();

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
