import {
  Clock,
  Package,
  Truck,
  CheckCircle2,
  X,
  ShieldCheck,
  ThumbsUp,
  ShoppingCart,
  ArrowRightCircle,
} from "lucide-react";
import {
  type PurchaseInput,
  type PurchaseStatus,
  type PurchaseType,
} from "@/hooks/useProjectPurchases";
import {
  getAllSupplierSubcategories,
  SUPPLIER_SUBCATEGORIES_BY_TYPE,
} from "@/constants/supplierCategories";

export const statusConfig: Record<
  PurchaseStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pendente",
    color:
      "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
    icon: Clock,
  },
  awaiting_approval: {
    label: "Solic. Aprovação",
    color: "bg-orange-500/20 text-orange-600 border-orange-500/30",
    icon: ShieldCheck,
  },
  approved: {
    label: "Aprovado",
    color: "bg-blue-500/20 text-blue-600 border-blue-500/30",
    icon: ThumbsUp,
  },
  purchased: {
    label: "Compra Realizada",
    color: "bg-indigo-500/20 text-indigo-600 border-indigo-500/30",
    icon: ShoppingCart,
  },
  ordered: {
    label: "Pedido",
    color: "bg-primary/20 text-primary border-primary/30",
    icon: Package,
  },
  in_transit: {
    label: "Em Trânsito",
    color: "bg-accent text-accent-foreground border-accent",
    icon: Truck,
  },
  delivered: {
    label: "Entregue",
    color:
      "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
    icon: CheckCircle2,
  },
  sent_to_site: {
    label: "Enviado p/ Obra",
    color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
    icon: ArrowRightCircle,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-muted text-muted-foreground border-muted",
    icon: X,
  },
};

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  produto: "Produto",
  prestador: "Prestador",
};

export const PURCHASE_TYPE_ICONS: Record<PurchaseType, string> = {
  produto: "📦",
  prestador: "🔧",
};

export const emptyPurchase: Partial<PurchaseInput> = {
  item_name: "",
  description: "",
  quantity: 1,
  unit: "un",
  estimated_cost: undefined,
  supplier_name: "",
  supplier_contact: "",
  lead_time_days: 7,
  required_by_date: "",
  notes: "",
  purchase_type: "produto",
  delivery_address: "",
};

/**
 * Purchase-item categories — derived from the central supplier taxonomy.
 */

/** @deprecated Use SUPPLIER_SUBCATEGORIES_BY_TYPE['produtos'] instead */
export const ITEM_CATEGORIES = SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos;

/** @deprecated Use SUPPLIER_SUBCATEGORIES_BY_TYPE['prestadores'] instead */
export const SERVICE_CATEGORIES = SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores;

/** @deprecated Use getAllSupplierSubcategories() instead */
export const ALL_CATEGORIES = getAllSupplierSubcategories();

export function isServiceCategory(category: string): boolean {
  return (
    SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores as readonly string[]
  ).includes(category);
}

/** Map purchase_type to the supplier taxonomy type for subcategory lookups */
export function purchaseTypeToSupplierType(
  purchaseType: PurchaseType | string | undefined,
): "prestadores" | "produtos" | null {
  if (purchaseType === "prestador") return "prestadores";
  if (purchaseType === "produto") return "produtos";
  return null;
}
