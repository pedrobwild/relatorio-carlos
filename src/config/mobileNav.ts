import {
  Home,
  Building2,
  DollarSign,
  AlertCircle,
  CheckSquare,
  FolderOpen,
  ClipboardSignature,
  User,
  type LucideIcon,
} from "lucide-react";
import type { useProjectNavigation } from "@/hooks/useProjectNavigation";

export type ProjectPaths = ReturnType<typeof useProjectNavigation>["paths"];

export type MobileNavBadge =
  | "criticalPendencias"
  | "unreadNotifications"
  | "none";

export type MobileNavSlot = {
  id: string;
  /** Short label (≤12 chars), never abbreviated. */
  label: string;
  icon: LucideIcon;
  /** Resolves to the destination URL. Receives project-scoped paths (when inside an obra), a fallback flag, the current projectId from URL and the last visited projectId (memory). */
  to: (ctx: {
    paths: ProjectPaths;
    hasProject: boolean;
    projectId?: string;
    lastProjectId?: string;
  }) => string;
  badge?: MobileNavBadge;
};

const HOME_CLIENT = "/minhas-obras";
const HOME_STAFF = "/gestao/painel-obras";
const STAFF_OBRAS_INDEX = "/gestao/painel-obras";
const STAFF_ATIVIDADES = "/gestao/atividades";
const STAFF_NCS = "/gestao/nao-conformidades";

// Helper: resolve effective projectId (current URL > last visited).
const effectiveProjectId = (ctx: {
  projectId?: string;
  lastProjectId?: string;
}) => ctx.projectId ?? ctx.lastProjectId;

export const CLIENT_NAV: MobileNavSlot[] = [
  {
    id: "obra",
    label: "Obra",
    icon: Building2,
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}` : HOME_CLIENT;
    },
    badge: "none",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}/financeiro` : HOME_CLIENT;
    },
    badge: "none",
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: FolderOpen,
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}/documentos` : HOME_CLIENT;
    },
    badge: "none",
  },
  {
    id: "formalizacoes",
    // Mobile bottom nav: "Formalizações" (13 chars) trunca em viewports
    // estreitos colando no rótulo vizinho. "Acordos" é o sinônimo curto já
    // usado no projeto (ver mem://features/formalizacoes/...).
    label: "Acordos",
    icon: ClipboardSignature,
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}/formalizacoes` : HOME_CLIENT;
    },
    badge: "none",
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
    // Quando há uma obra ativa (URL) ou uma obra recém-visitada, voltar
    // direto para ela em vez do painel global — evita o usuário "perder" a
    // obra ao alternar entre Início e Obras.
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}` : STAFF_OBRAS_INDEX;
    },
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
    to: (ctx) => {
      const id = effectiveProjectId(ctx);
      return id ? `/obra/${id}/pendencias` : STAFF_NCS;
    },
    badge: "criticalPendencias",
  },
];

export const PROFILE_SLOT = {
  id: "perfil",
  label: "Perfil",
  icon: User,
} as const;
