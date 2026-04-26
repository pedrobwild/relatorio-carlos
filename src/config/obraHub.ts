import {
  type LucideIcon,
  Map as MapIcon,
  LayoutDashboard,
  GanttChartSquare,
  ShoppingCart,
  AlertCircle,
  FileSignature,
  DollarSign,
  ClipboardCheck,
  AlertTriangle,
  FolderOpen,
  FileText,
  Box,
  HardHat,
  Calculator,
  UserCircle,
} from 'lucide-react';
import type { useProjectNavigation } from '@/hooks/useProjectNavigation';

type Paths = ReturnType<typeof useProjectNavigation>['paths'];

export type HubSectionId =
  | 'jornada'
  | 'painel'
  | 'cronograma'
  | 'compras'
  | 'pendencias'
  | 'formalizacoes'
  | 'financeiro'
  | 'vistorias'
  | 'naoConformidades'
  | 'documentos'
  | 'contrato'
  | 'projeto3D'
  | 'executivo'
  | 'orcamento'
  | 'dadosCliente';

export type HubSectionMeta = {
  id: HubSectionId;
  label: string;
  icon: LucideIcon;
  to: (paths: Paths) => string;
  /** Hide this section from clients (only staff sees it). */
  staffOnly?: boolean;
};

export const HUB_SECTIONS: Record<HubSectionId, HubSectionMeta> = {
  jornada: { id: 'jornada', label: 'Jornada', icon: MapIcon, to: (p) => p.jornada },
  painel: { id: 'painel', label: 'Painel da obra', icon: LayoutDashboard, to: (p) => p.relatorio },
  cronograma: { id: 'cronograma', label: 'Cronograma', icon: GanttChartSquare, to: (p) => p.cronograma },
  compras: { id: 'compras', label: 'Compras', icon: ShoppingCart, to: (p) => p.compras, staffOnly: true },

  pendencias: { id: 'pendencias', label: 'Pendências', icon: AlertCircle, to: (p) => p.pendencias },
  formalizacoes: { id: 'formalizacoes', label: 'Formalizações', icon: FileSignature, to: (p) => p.formalizacoes },
  financeiro: { id: 'financeiro', label: 'Financeiro', icon: DollarSign, to: (p) => p.financeiro },
  vistorias: { id: 'vistorias', label: 'Vistorias', icon: ClipboardCheck, to: (p) => p.vistorias, staffOnly: true },
  naoConformidades: { id: 'naoConformidades', label: 'Não conformidades', icon: AlertTriangle, to: (p) => p.naoConformidades, staffOnly: true },

  documentos: { id: 'documentos', label: 'Documentos', icon: FolderOpen, to: (p) => p.documentos },
  contrato: { id: 'contrato', label: 'Contrato', icon: FileText, to: (p) => p.contrato },
  projeto3D: { id: 'projeto3D', label: 'Projeto 3D', icon: Box, to: (p) => p.projeto3D },
  executivo: { id: 'executivo', label: 'Executivo', icon: HardHat, to: (p) => p.executivo },
  orcamento: { id: 'orcamento', label: 'Orçamento', icon: Calculator, to: (p) => p.orcamento, staffOnly: true },
  dadosCliente: { id: 'dadosCliente', label: 'Dados do cliente', icon: UserCircle, to: (p) => p.dadosCliente, staffOnly: true },
};

export type HubGroupId = 'acompanhar' | 'decidir' | 'documentar';

export type HubGroupConfig = {
  id: HubGroupId;
  label: string;
  items: HubSectionId[];
};

export const HUB_GROUPS: HubGroupConfig[] = [
  {
    id: 'acompanhar',
    label: 'Acompanhar',
    items: ['jornada', 'painel', 'cronograma', 'compras'],
  },
  {
    id: 'decidir',
    label: 'Decidir',
    items: ['pendencias', 'formalizacoes', 'financeiro', 'vistorias', 'naoConformidades'],
  },
  {
    id: 'documentar',
    label: 'Documentar',
    items: ['documentos', 'contrato', 'projeto3D', 'executivo', 'orcamento', 'dadosCliente'],
  },
];

/**
 * Returns sections visible for the given role, preserving the canonical group
 * ordering. Empty groups are dropped.
 */
export function getVisibleHubGroups(isStaff: boolean): HubGroupConfig[] {
  return HUB_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((id) => isStaff || !HUB_SECTIONS[id].staffOnly),
  })).filter((group) => group.items.length > 0);
}
