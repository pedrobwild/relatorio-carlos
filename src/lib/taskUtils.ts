import type { StaffUser } from "@/hooks/useStaffUsers";
import type { ObraTaskPriority } from "@/hooks/useObraTasks";

// ── Shared member name resolver ──────────────────────────────
export function getMemberName(
  staffUsers: StaffUser[],
  userId: string | null,
): string | null {
  if (!userId) return null;
  const u = staffUsers.find((u) => u.id === userId);
  return u?.nome || u?.email || null;
}

// ── Overdue check ────────────────────────────────────────────
export function isTaskOverdue(task: {
  due_date?: string | null;
  status: string;
}): boolean {
  if (!task.due_date) return false;
  if (task.status === "concluido") return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

// ── Priority visual config ───────────────────────────────────
export const priorityConfig: Record<
  ObraTaskPriority,
  { label: string; color: string; icon: string; dot: string }
> = {
  baixa: {
    label: "Baixa",
    color: "text-muted-foreground",
    icon: "▽",
    dot: "bg-slate-400",
  },
  media: {
    label: "Média",
    color: "text-amber-600",
    icon: "═",
    dot: "bg-amber-500",
  },
  alta: {
    label: "Alta",
    color: "text-orange-600",
    icon: "△",
    dot: "bg-orange-500",
  },
  critica: {
    label: "Crítica",
    color: "text-destructive",
    icon: "⬆",
    dot: "bg-red-600",
  },
};

// ── Deterministic color for project badges ───────────────────
// Cores fortes (saturadas) com texto branco para garantir alto contraste sobre
// qualquer fundo (cards, modais, dialogs). Antes usávamos bg /15 que ficava
// quase invisível em alguns contextos. Agora as barras do calendário ficam
// legíveis tanto em light quanto em dark mode.
const PROJECT_COLORS = [
  { bg: "bg-blue-600 text-white", border: "border-blue-700" },
  { bg: "bg-emerald-600 text-white", border: "border-emerald-700" },
  { bg: "bg-violet-600 text-white", border: "border-violet-700" },
  { bg: "bg-amber-600 text-white", border: "border-amber-700" },
  { bg: "bg-rose-600 text-white", border: "border-rose-700" },
  { bg: "bg-cyan-700 text-white", border: "border-cyan-800" },
  { bg: "bg-fuchsia-600 text-white", border: "border-fuchsia-700" },
  { bg: "bg-lime-700 text-white", border: "border-lime-800" },
];

export function getProjectColor(projectId: string) {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// ── Status visual maps ───────────────────────────────────────
export const statusVariant: Record<string, string> = {
  pendente: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  em_andamento: "bg-blue-500/15 text-blue-700 border-blue-300",
  pausado: "bg-orange-500/15 text-orange-700 border-orange-300",
  concluido: "bg-green-500/15 text-green-700 border-green-300",
};

export const statusDots: Record<string, string> = {
  pendente: "bg-yellow-500",
  em_andamento: "bg-blue-500",
  pausado: "bg-orange-500",
  concluido: "bg-green-500",
};

// ── Initials helper ──────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split("")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
