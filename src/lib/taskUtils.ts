import type { StaffUser } from '@/hooks/useStaffUsers';
import type { ObraTaskPriority } from '@/hooks/useObraTasks';

// ── Shared member name resolver ──────────────────────────────
export function getMemberName(staffUsers: StaffUser[], userId: string | null): string | null {
  if (!userId) return null;
  const u = staffUsers.find(u => u.id === userId);
  return u?.nome || u?.email || null;
}

// ── Overdue check ────────────────────────────────────────────
export function isTaskOverdue(task: { due_date?: string | null; status: string }): boolean {
  if (!task.due_date) return false;
  if (task.status === 'concluido') return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

// ── Priority visual config ───────────────────────────────────
export const priorityConfig: Record<ObraTaskPriority, { label: string; color: string; icon: string; dot: string }> = {
  baixa: { label: 'Baixa', color: 'text-muted-foreground', icon: '▽', dot: 'bg-slate-400' },
  media: { label: 'Média', color: 'text-amber-600', icon: '═', dot: 'bg-amber-500' },
  alta: { label: 'Alta', color: 'text-orange-600', icon: '△', dot: 'bg-orange-500' },
  critica: { label: 'Crítica', color: 'text-destructive', icon: '⬆', dot: 'bg-red-600' },
};

// ── Deterministic color for project badges ───────────────────
const PROJECT_COLORS = [
  { bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
  { bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  { bg: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', border: 'border-violet-300 dark:border-violet-700' },
  { bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  { bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-700' },
  { bg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-700' },
  { bg: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400', border: 'border-fuchsia-300 dark:border-fuchsia-700' },
  { bg: 'bg-lime-500/15 text-lime-700 dark:text-lime-400', border: 'border-lime-300 dark:border-lime-700' },
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
  pendente: 'bg-yellow-500/15 text-yellow-700 border-yellow-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 border-blue-300',
  pausado: 'bg-orange-500/15 text-orange-700 border-orange-300',
  concluido: 'bg-green-500/15 text-green-700 border-green-300',
};

export const statusDots: Record<string, string> = {
  pendente: 'bg-yellow-500',
  em_andamento: 'bg-blue-500',
  pausado: 'bg-orange-500',
  concluido: 'bg-green-500',
};

// ── Initials helper ──────────────────────────────────────────
export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
