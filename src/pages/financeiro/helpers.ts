import { ProjectPayment } from "@/hooks/useProjectPayments";
import { differenceInDays } from "date-fns";

/** Parse a date string as local date to avoid UTC timezone offset issues */
export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const getTodayLocal = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const getPaymentStatus = (
  payment: ProjectPayment,
): "paid" | "pending" | "upcoming" => {
  const todayLocal = getTodayLocal();
  if (payment.paid_at) return "paid";
  if (!payment.due_date) return "pending";
  const dueDate = parseLocalDate(payment.due_date);
  if (dueDate <= todayLocal) return "pending";
  return "upcoming";
};

export const getUrgency = (
  payment: ProjectPayment,
): "overdue" | "urgent" | "approaching" | "normal" => {
  const todayLocal = getTodayLocal();
  if (payment.paid_at) return "normal";
  if (!payment.due_date) return "normal";
  const dueDate = parseLocalDate(payment.due_date);
  const daysUntilDue = differenceInDays(dueDate, todayLocal);
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 2) return "urgent";
  if (daysUntilDue <= 5) return "approaching";
  return "normal";
};

export const getDaysLabel = (
  payment: ProjectPayment,
): { text: string; color: string } | null => {
  const todayLocal = getTodayLocal();
  if (payment.paid_at) return null;
  if (!payment.due_date)
    return { text: "Em definição", color: "text-muted-foreground" };
  const dueDate = parseLocalDate(payment.due_date);
  const days = differenceInDays(dueDate, todayLocal);
  if (days < 0)
    return { text: `${Math.abs(days)} dias em atraso`, color: "text-red-600" };
  if (days === 0) return { text: "Vence hoje", color: "text-red-600" };
  if (days === 1) return { text: "Vence amanhã", color: "text-amber-600" };
  if (days <= 5)
    return { text: `Vence em ${days} dias`, color: "text-amber-600" };
  return null;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};
