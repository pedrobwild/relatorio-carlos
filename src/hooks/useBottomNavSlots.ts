import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  GanttChartSquare,
  Ruler,
  DollarSign,
  Map,
  ShoppingCart,
  FolderOpen,
  ClipboardSignature,
  Eye,
  FileText,
  CheckSquare,
  AlertTriangle,
  Users,
  ClipboardList,
  Box,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "mobile-bottom-nav-slots";
const MAX_SLOTS = 4;

export interface NavSlot {
  key: string;
  label: string;
  icon: LucideIcon;
  pathKey: string; // key in useProjectNavigation().paths
}

export const ALL_NAV_OPTIONS: NavSlot[] = [
  {
    key: "pendencias",
    label: "Pendências",
    icon: AlertCircle,
    pathKey: "pendencias",
  },
  {
    key: "cronograma",
    label: "Cronograma",
    icon: GanttChartSquare,
    pathKey: "cronograma",
  },
  {
    key: "atividades",
    label: "Atividades",
    icon: CheckSquare,
    pathKey: "atividades",
  },
  { key: "executivo", label: "Executivo", icon: Ruler, pathKey: "executivo" },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    pathKey: "financeiro",
  },
  { key: "jornada", label: "Jornada", icon: Map, pathKey: "jornada" },
  { key: "compras", label: "Compras", icon: ShoppingCart, pathKey: "compras" },
  { key: "vistorias", label: "Vistorias", icon: Eye, pathKey: "vistorias" },
  {
    key: "naoConformidades",
    label: "Não Conformidades",
    icon: AlertTriangle,
    pathKey: "naoConformidades",
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: FolderOpen,
    pathKey: "documentos",
  },
  {
    key: "formalizacoes",
    label: "Formalizações",
    icon: ClipboardSignature,
    pathKey: "formalizacoes",
  },
  { key: "contrato", label: "Contrato", icon: FileText, pathKey: "contrato" },
  { key: "projeto3D", label: "Projeto 3D", icon: Box, pathKey: "projeto3D" },
  {
    key: "dadosCliente",
    label: "Dados do Cliente",
    icon: Users,
    pathKey: "dadosCliente",
  },
  {
    key: "orcamento",
    label: "Orçamento",
    icon: ClipboardList,
    pathKey: "orcamento",
  },
];

const DEFAULT_STAFF_KEYS = [
  "pendencias",
  "cronograma",
  "executivo",
  "financeiro",
];

function loadSlots(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === MAX_SLOTS) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSlots(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function useBottomNavSlots() {
  const [slotKeys, setSlotKeys] = useState<string[]>(
    () => loadSlots() ?? DEFAULT_STAFF_KEYS,
  );

  useEffect(() => {
    saveSlots(slotKeys);
  }, [slotKeys]);

  const slots: NavSlot[] = slotKeys
    .map((key) => ALL_NAV_OPTIONS.find((o) => o.key === key))
    .filter(Boolean) as NavSlot[];

  const updateSlots = useCallback((newKeys: string[]) => {
    if (newKeys.length === MAX_SLOTS) {
      setSlotKeys(newKeys);
    }
  }, []);

  const resetToDefault = useCallback(() => {
    setSlotKeys(DEFAULT_STAFF_KEYS);
  }, []);

  return {
    slots,
    slotKeys,
    updateSlots,
    resetToDefault,
    allOptions: ALL_NAV_OPTIONS,
  };
}
