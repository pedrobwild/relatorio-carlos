/**
 * Modo do menu de gestão (Fase 0 da reformulação do processo core).
 *
 * "simple"  → Obras / Semana / Hoje. Padrão para quem só executa obra.
 * "full"    → menu completo de gestão (escritório, admin, suprimentos…).
 *
 * Regras, nesta ordem:
 *   1. Override do usuário (localStorage) vence sempre — ninguém fica preso.
 *   2. Se a flag `simpleModeGestor` estiver desligada, menu completo.
 *   3. Modo simples só para quem tem exclusivamente papéis de campo
 *      (`gestor` e/ou `engineer`). Qualquer papel de escritório (admin,
 *      manager, suprimentos, financeiro, cs, arquitetura) mantém o completo.
 *
 * Funções puras para serem testáveis sem React.
 */

import type { AppRole } from "@/hooks/useUserRole";

export type MenuMode = "simple" | "full";

/** Papéis que, sozinhos, caracterizam "gestor de obra" para fins de menu. */
export const FIELD_ROLES: readonly AppRole[] = ["gestor", "engineer"];

export const MENU_MODE_STORAGE_PREFIX = "bwild.menuMode.";

export function menuModeStorageKey(userId: string | null | undefined): string {
  return `${MENU_MODE_STORAGE_PREFIX}${userId ?? "anon"}`;
}

/**
 * true quando o usuário tem ≥1 papel de equipe e todos são de campo.
 * `customer` não conta: quem é gestor e também cliente de uma obra própria
 * continua sendo gestor de obra para o menu.
 */
export function isFieldOnlyRoles(roles: readonly AppRole[]): boolean {
  const staffRoles = roles.filter((role) => role !== "customer");
  if (staffRoles.length === 0) return false;
  return staffRoles.every((role) => FIELD_ROLES.includes(role));
}

export interface ResolveMenuModeInput {
  flagEnabled: boolean;
  roles: readonly AppRole[];
  override: MenuMode | null;
}

/** Modo que o usuário teria sem override (o "padrão" dele). */
export function defaultMenuMode(
  input: Omit<ResolveMenuModeInput, "override">,
): MenuMode {
  if (!input.flagEnabled) return "full";
  return isFieldOnlyRoles(input.roles) ? "simple" : "full";
}

export function resolveMenuMode(input: ResolveMenuModeInput): MenuMode {
  if (input.override === "simple" || input.override === "full") {
    return input.override;
  }
  return defaultMenuMode(input);
}

export function readMenuModeOverride(
  storage: Pick<Storage, "getItem"> | null | undefined,
  userId: string | null | undefined,
): MenuMode | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(menuModeStorageKey(userId));
    return raw === "simple" || raw === "full" ? raw : null;
  } catch {
    return null;
  }
}

export function writeMenuModeOverride(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  userId: string | null | undefined,
  mode: MenuMode | null,
): void {
  if (!storage) return;
  try {
    const key = menuModeStorageKey(userId);
    if (mode === null) storage.removeItem(key);
    else storage.setItem(key, mode);
  } catch {
    /* localStorage indisponível (modo privado, quota) — ignora */
  }
}
