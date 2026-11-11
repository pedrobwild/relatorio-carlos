import {
  Building2,
  DollarSign,
  AlertCircle,
  CalendarCheck,
  CalendarRange,
  FolderOpen,
  ClipboardSignature,
  Plus,
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
  /**
   * Exact-match the active state. Required for slots whose destination is a
   * prefix of other slots' routes — e.g. the obra hub (`/obra/:id`) is a
   * prefix of `/obra/:id/financeiro`, so a plain prefix match would keep the
   * hub tab highlighted alongside the real tab on every sub-route.
   */
  end?: boolean;
  /**
   * Also treat the report-hub route (`/obra/:id/relatorio`) as active. That
   * route renders the same `Index` hub page as `/obra/:id` (see App.tsx), so
   * the Obra tab must stay lit there even though `end` otherwise demands an
   * exact match. Only meaningful together with `end` on the obra hub slots.
   */
  matchReportHub?: boolean;
  /** Outras rotas (prefixo) em que esta aba também fica acesa. */
  alsoActiveOn?: readonly string[];
};

const HOME_CLIENT = "/minhas-obras";
const STAFF_OBRAS_INDEX = "/gestao/painel-obras";
const STAFF_HOJE = "/gestao/hoje";
export const STAFF_OBRAS_NOVO = "/gestao/obras";
export const STAFF_OBRAS_LEGADO = "/gestao/painel-obras";
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
    // Project hub root — exact match so it doesn't stay active on sub-routes
    // (financeiro, documentos…), which would double-highlight the bar. The
    // report-hub alias (`/obra/:id/relatorio`) renders the same hub page, so
    // keep the tab lit there too.
    end: true,
    matchReportHub: true,
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

/**
 * Barra da equipe no celular (redesenho mobile, passo 1):
 * Hoje · Obras · [Registrar] · Pendências · Perfil.
 *
 * "Obras" sempre abre a lista de obras (antes voltava para a última obra
 * visitada, e a pessoa não achava mais a lista). Dentro de uma obra a aba
 * continua acesa, menos em Pendências, que tem aba própria.
 * O botão central Registrar não é um link: ver `staffBottomBar`.
 */
export const STAFF_NAV: MobileNavSlot[] = [
  {
    id: "hoje",
    label: "Hoje",
    icon: CalendarCheck,
    to: () => STAFF_HOJE,
    badge: "none",
  },
  {
    id: "obras",
    label: "Obras",
    icon: Building2,
    to: () => STAFF_OBRAS_INDEX,
    alsoActiveOn: [STAFF_OBRAS_NOVO, "/obra/"],
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

/**
 * Barra do celular no modo simples (gestor de obra): as mesmas três telas do
 * menu lateral — Obras / Semana / Hoje. Sem isso, no celular (onde a tela
 * Hoje é usada) o gestor só chegava nelas pelo menu hambúrguer.
 *
 * `obrasPath` segue a flag `novoPainelObras`: tela Obras nova ou o Painel.
 */
export function staffSimpleNav(obrasPath: string): MobileNavSlot[] {
  return [
    {
      id: "obras-simples",
      label: "Obras",
      icon: Building2,
      to: () => obrasPath,
      // "Painel completo" e a própria obra continuam sendo "Obras".
      alsoActiveOn: [STAFF_OBRAS_NOVO, STAFF_OBRAS_LEGADO, "/obra/"],
      badge: "none",
    },
    {
      id: "semana",
      label: "Semana",
      icon: CalendarRange,
      to: () => "/gestao/semana",
      badge: "none",
    },
    {
      id: "hoje",
      label: "Hoje",
      icon: CalendarCheck,
      to: () => STAFF_HOJE,
      badge: "none",
    },
  ];
}

/** Botão central da barra da equipe: abre a gaveta Registrar (não navega). */
export const REGISTRAR_SLOT = {
  id: "registrar",
  label: "Registrar",
  icon: Plus,
} as const;

export type StaffBarItem =
  | { kind: "link"; slot: MobileNavSlot }
  | { kind: "registrar" };

/**
 * Itens da barra da equipe, na ordem em que aparecem (o Perfil vem depois,
 * sempre por último). O Registrar fica no meio dos cinco espaços:
 *   completo: Hoje · Obras · [Registrar] · Pendências
 *   simples:  Obras · Semana · [Registrar] · Hoje
 */
export function staffBottomBar(opts: { simple: boolean; obrasPath: string }): StaffBarItem[] {
  const slots = opts.simple ? staffSimpleNav(opts.obrasPath) : STAFF_NAV;
  const items: StaffBarItem[] = slots.map((slot) => ({ kind: "link", slot }));
  items.splice(2, 0, { kind: "registrar" });
  return items;
}

type SlotCtx = Parameters<MobileNavSlot["to"]>[0];

/**
 * Qual aba da equipe fica acesa em `pathname`: no máximo uma. Quando mais de
 * uma casa (ex.: "Obras" cobre `/obra/` e "Pendências" é `/obra/:id/pendencias`),
 * vence o prefixo mais longo.
 */
export function resolveActiveStaffSlotId(
  slots: readonly MobileNavSlot[],
  pathname: string,
  ctx: SlotCtx,
): string | null {
  const covers = (prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");
  let best: { id: string; len: number } | null = null;
  for (const slot of slots) {
    const prefixes = [slot.to(ctx), ...(slot.alsoActiveOn ?? [])];
    for (const prefix of prefixes) {
      if (!covers(prefix)) continue;
      if (!best || prefix.length > best.len) best = { id: slot.id, len: prefix.length };
    }
  }
  return best?.id ?? null;
}

export const PROFILE_SLOT = {
  id: "perfil",
  label: "Perfil",
  icon: User,
} as const;
