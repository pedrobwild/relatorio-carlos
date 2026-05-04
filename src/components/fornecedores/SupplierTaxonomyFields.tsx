import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPES,
  getSubcategoriesByType,
  isValidSupplierSubcategory,
  type SupplierType,
} from "@/constants/supplierCategories";
import { normalizeSupplierTaxonomy } from "@/components/fornecedores/supplierTaxonomy";

interface SupplierTaxonomyFieldsProps {
  supplierType: string | null | undefined;
  supplierSubcategory: string | null | undefined;
  onSupplierTypeChange: (value: SupplierType) => void;
  onSupplierSubcategoryChange: (value: string | null) => void;
}

export function SupplierTaxonomyFields({
  supplierType,
  supplierSubcategory,
  onSupplierTypeChange,
  onSupplierSubcategoryChange,
}: SupplierTaxonomyFieldsProps) {
  const normalizedTaxonomy = normalizeSupplierTaxonomy(
    supplierType,
    supplierSubcategory,
  );
  const resolvedType = normalizedTaxonomy.supplier_type;
  const resolvedSubcategory = normalizedTaxonomy.supplier_subcategory;
  const availableSubcategories = getSubcategoriesByType(resolvedType);

  const handleTypeChange = (value: string) => {
    const nextType = value as SupplierType;
    onSupplierTypeChange(nextType);

    if (
      resolvedSubcategory &&
      !isValidSupplierSubcategory(nextType, resolvedSubcategory)
    ) {
      onSupplierSubcategoryChange(null);
    }
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label>Categoria *</Label>
        <Select value={resolvedType ?? ""} onValueChange={handleTypeChange}>
          <SelectTrigger aria-label="Categoria do fornecedor">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent position="popper">
            {SUPPLIER_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {SUPPLIER_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Subcategoria *</Label>
        <Select
          key={resolvedType ?? "no-type"}
          value={resolvedSubcategory ?? ""}
          onValueChange={(value) => onSupplierSubcategoryChange(value || null)}
          disabled={!resolvedType}
        >
          <SelectTrigger aria-label="Subcategoria do fornecedor">
            <SelectValue
              placeholder={
                resolvedType ? "Selecione..." : "Escolha a categoria primeiro"
              }
            />
          </SelectTrigger>
          <SelectContent position="popper">
            {availableSubcategories.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
