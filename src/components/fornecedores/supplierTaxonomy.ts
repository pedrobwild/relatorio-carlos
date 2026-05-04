import {
  inferTypeFromSubcategory,
  isValidSupplierSubcategory,
  isValidSupplierType,
  type SupplierType,
} from "@/constants/supplierCategories";

export interface NormalizedSupplierTaxonomy {
  supplier_type: SupplierType | null;
  supplier_subcategory: string | null;
}

export function normalizeSupplierTaxonomy(
  supplierType: string | null | undefined,
  supplierSubcategory: string | null | undefined,
): NormalizedSupplierTaxonomy {
  const normalizedSubcategory =
    typeof supplierSubcategory === "string"
      ? supplierSubcategory.trim() || null
      : null;

  const directType =
    typeof supplierType === "string" && isValidSupplierType(supplierType)
      ? supplierType
      : null;

  const inferredType = normalizedSubcategory
    ? inferTypeFromSubcategory(normalizedSubcategory)
    : null;

  const resolvedType = directType ?? inferredType;

  if (!resolvedType) {
    return {
      supplier_type: null,
      supplier_subcategory: null,
    };
  }

  if (!normalizedSubcategory) {
    return {
      supplier_type: resolvedType,
      supplier_subcategory: null,
    };
  }

  if (!isValidSupplierSubcategory(resolvedType, normalizedSubcategory)) {
    return {
      supplier_type: resolvedType,
      supplier_subcategory: null,
    };
  }

  return {
    supplier_type: resolvedType,
    supplier_subcategory: normalizedSubcategory,
  };
}
