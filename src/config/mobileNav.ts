import {
  type LucideIcon,
  Home,
  Building2,
  DollarSign,
  AlertCircle,
  CheckSquare,
  User,
} from 'lucide-react';
import type { useProjectNavigation } from '@/hooks/useProjectNavigation';

type Paths = ReturnType<typeof useProjectNavigation>['paths'];

export type MobileNavBadge = 'criticalPendencias' | 'unreadNotifications' | 'none';

export type MobileNavSlot = {
  id: string;
  label: string;
  icon: LucideIcon;
  to: (paths: Paths) => string;
  badge?: MobileNavBadge;
};

export const CLIENT_NAV: MobileNavSlot[] = [
  { id: 'inicio', label: 'Início', icon: Home, to: (p) => p.clientHome, badge: 'none' },
  { id: 'obra', label: 'Obra', icon: Building2, to: (p) => p.obraHub, badge: 'none' },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign, to: (p) => p.financeiro, badge: 'none' },
  { id: 'pendencias', label: 'Pendências', icon: AlertCircle, to: (p) => p.pendencias, badge: 'criticalPendencias' },
];

export const STAFF_NAV: MobileNavSlot[] = [
  { id: 'inicio', label: 'Início', icon: Home, to: (p) => p.staffHome, badge: 'none' },
  { id: 'obras', label: 'Obras', icon: Building2, to: (p) => p.obrasIndex, badge: 'none' },
  { id: 'atividades', label: 'Atividades', icon: CheckSquare, to: (p) => p.gestaoAtividades, badge: 'none' },
  // No global staff pendencias view yet — falls back to atividades. Tracked as a
  // follow-up to issue #29.
  { id: 'pendencias', label: 'Pendências', icon: AlertCircle, to: (p) => p.gestaoAtividades, badge: 'criticalPendencias' },
];

export const PROFILE_SLOT = {
  id: 'perfil',
  label: 'Perfil',
  icon: User,
} as const;
