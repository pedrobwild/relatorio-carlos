import type { UserWithRole } from "@/hooks/useUsers";
import type { AppRole } from "@/hooks/useUserRole";

export type IdentifierType = "email" | "cpf";

export const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gestor de Engenharia",
  engineer: "Engenheiro",
  arquitetura: "Arquitetura",
  customer: "Cliente",
  gestor: "Gestor",
  suprimentos: "Suprimentos",
  financeiro: "Financeiro",
  cs: "Customer Success",
};

export const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-accent/10 text-accent-foreground border-accent/20",
  engineer: "bg-primary/10 text-primary border-primary/20",
  arquitetura: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  customer: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  gestor: "bg-accent/10 text-accent-foreground border-accent/20",
  suprimentos: "bg-primary/10 text-primary border-primary/20",
  financeiro: "bg-primary/10 text-primary border-primary/20",
  cs: "bg-secondary/10 text-secondary-foreground border-secondary/20",
};

export interface ProjectOption {
  id: string;
  name: string;
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10], 10)) return false;

  return true;
}

export function cpfToEmail(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  return `${digits}@cpf.bwild.com.br`;
}
