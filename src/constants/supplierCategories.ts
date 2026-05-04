/**
 * Central source of truth for supplier taxonomy.
 *
 * Two-level hierarchy:
 *   supplier_type  → 'prestadores' | 'produtos'
 *   supplier_subcategory → one of the values listed below per type
 *
 * NOTE: The legacy `categoria` enum on the `fornecedores` table
 * (materiais | mao_de_obra | servicos | equipamentos | outros)
 * is kept for backward-compat but should NOT be used for new UI.
 */

// ── Types ────────────────────────────────────────────────────

export const SUPPLIER_TYPES = ["prestadores", "produtos"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  prestadores: "Prestadores",
  produtos: "Produtos",
};

// ── Subcategories ────────────────────────────────────────────

const PRESTADORES_SUBCATEGORIES = [
  "Marcenaria",
  "Empreita",
  "Vidraçaria Box",
  "Vidraçaria Sacada",
  "Eletricista",
  "Pintor",
  "Instalador de Piso",
  "Técnico Ar-Condicionado",
  "Gesseiro",
  "Serviços Gerais",
  "Limpeza",
  "Pedreiro",
  "Instalador Fechadura Digital",
  "Cortinas",
  "Marmoraria",
  "Jardim Vertical",
] as const;

const PRODUTOS_SUBCATEGORIES = [
  "Eletrodomésticos",
  "Enxoval",
  "Espelhos",
  "Decoração",
  "Revestimentos",
  "Luminárias",
  "Cadeiras e Mesas",
  "Camas",
  "Sofás e Poltronas",
  "Tapeçaria",
  "Torneiras e Cubas",
  "Materiais Elétricos",
  "Materiais de Construção",
  "Acessórios Banheiro",
  "Fechadura Digital",
  "Tintas",
] as const;

export type PrestadorSubcategory = (typeof PRESTADORES_SUBCATEGORIES)[number];
export type ProdutoSubcategory = (typeof PRODUTOS_SUBCATEGORIES)[number];
export type SupplierSubcategory = PrestadorSubcategory | ProdutoSubcategory;

export const SUPPLIER_SUBCATEGORIES_BY_TYPE: Record<
  SupplierType,
  readonly string[]
> = {
  prestadores: PRESTADORES_SUBCATEGORIES,
  produtos: PRODUTOS_SUBCATEGORIES,
};

// ── Helpers ──────────────────────────────────────────────────

/** Get subcategories for a given type */
export function getSubcategoriesByType(
  type: SupplierType | string | null | undefined,
): readonly string[] {
  if (!type || !isValidSupplierType(type)) return [];
  return SUPPLIER_SUBCATEGORIES_BY_TYPE[type as SupplierType];
}

/** Type guard */
export function isValidSupplierType(value: string): value is SupplierType {
  return (SUPPLIER_TYPES as readonly string[]).includes(value);
}

/** Validate a subcategory against its parent type */
export function isValidSupplierSubcategory(
  type: string,
  subcategory: string,
): boolean {
  if (!isValidSupplierType(type)) return false;
  return SUPPLIER_SUBCATEGORIES_BY_TYPE[type as SupplierType].includes(
    subcategory,
  );
}

/** Flat list of all subcategories (useful for search) */
export function getAllSupplierSubcategories(): string[] {
  return [...PRESTADORES_SUBCATEGORIES, ...PRODUTOS_SUBCATEGORIES];
}

/** Infer supplier_type from a subcategory value */
export function inferTypeFromSubcategory(
  subcategory: string,
): SupplierType | null {
  if ((PRESTADORES_SUBCATEGORIES as readonly string[]).includes(subcategory))
    return "prestadores";
  if ((PRODUTOS_SUBCATEGORIES as readonly string[]).includes(subcategory))
    return "produtos";
  return null;
}
