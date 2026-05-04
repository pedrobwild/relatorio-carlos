import {
  Home,
  Building2,
  DollarSign,
  AlertCircle,
  CheckSquare,
  User,
  type LucideIcon,
} from "lucide-react";
import type { useProjectNavigation } from "@/hooks/useProjectNavigation";

export type ProjectPaths = ReturnType<typeof useProjectNavigation>["paths"];

export type MobileNavBadge = "criticalPendencias" | "unreadNotifications" | "none";

export type MobileNavSlot = {
  id: string;
  /** Short label (≤10 chars), never abbreviated. */
  label: string;
  icon: LucideIcon;
  /** Resolves to the destination URL. Receives both project-scoped paths (when inside an obra) and a fallback flag. */
  to: (ctx: { paths: ProjectPaths; hasProject: boolean }) => string;
  badge?: MobileNavBadge;
};

const HOME_CLIENT = "/minhas-obras";
const HOME_STAFF = "/gestao/painel-obras";
const STAFF_OBRAS_INDEX = "/gestao/painel-obras";
const STAFF_ATIVIDADES = "/gestao/atividades";
const STAFF_NCS = "/gestao/nao-conformidades";

export const CLIENT_NAV: MobileNavSlot[] = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    to: () => HOME_CLIENT,
    badge: "none",
  },
  {
    id: "obra",
    label: "Obra",
    icon: Building2,
    // Hub-da-obra is not built yet (C2); falls back to the project's "relatório" landing.
    to: ({ paths, hasProject }) => (hasProject ? paths.relatorio : HOME_CLIENT),
    badge: "none",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    to: ({ paths, hasProject }) => (hasProject ? paths.financeiro : HOME_CLIENT),
    badge: "none",
  },
  {
    id: "pendencias",
    label: "Pendências",
    icon: AlertCircle,
    to: ({ paths, hasProject }) => (hasProject ? paths.pendencias : HOME_CLIENT),
    badge: "criticalPendencias",
  },
];

export const STAFF_NAV: MobileNavSlot[] = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    to: () => HOME_STAFF,
    badge: "none",
  },
  {
    id: "obras",
    label: "Obras",
    icon: Building2,
    to: () => STAFF_OBRAS_INDEX,
    badge: "none",
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: CheckSquare,
    to: () => STAFF_ATIVIDADES,
    badge: "none",
  },
  {
    id: "pendencias",
    label: "Pendências",
    icon: AlertCircle,
    // No global staff "pendências" page yet; NCs are the closest cross-obra analog.
    to: ({ paths, hasProject }) => (hasProject ? paths.pendencias : STAFF_NCS),
    badge: "criticalPendencias",
  },
];

export const PROFILE_SLOT = {
  id: "perfil",
  label: "Perfil",
  icon: User,
} as const;
