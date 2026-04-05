import { Clock, Package, Truck, CheckCircle2, X } from 'lucide-react';
import { PurchaseStatus } from '@/hooks/useProjectPurchases';
import type { PurchaseInput } from '@/hooks/useProjectPurchases';
import { getAllSupplierSubcategories, SUPPLIER_SUBCATEGORIES_BY_TYPE } from '@/constants/supplierCategories';

export const statusConfig: Record<PurchaseStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30', icon: Clock },
  ordered: { label: 'Pedido', color: 'bg-primary/20 text-primary border-primary/30', icon: Package },
  in_transit: { label: 'Em Trânsito', color: 'bg-accent text-accent-foreground border-accent', icon: Truck },
  delivered: { label: 'Concluído', color: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-muted', icon: X },
};

export const emptyPurchase: Partial<PurchaseInput> = {
  item_name: '',
  description: '',
  quantity: 1,
  unit: 'un',
  estimated_cost: undefined,
  supplier_name: '',
  supplier_contact: '',
  lead_time_days: 7,
  required_by_date: '',
  notes: '',
};

/**
 * Purchase-item categories — derived from the central supplier taxonomy.
 *
 * These are used for the `category` field on `project_purchases`.
 * They classify the *item being purchased*, not the supplier itself.
 *
 * The supplier taxonomy (supplier_type + supplier_subcategory) lives in
 * `src/constants/supplierCategories.ts` and is the single source of truth.
 */

/** @deprecated Use SUPPLIER_SUBCATEGORIES_BY_TYPE['produtos'] instead */
export const ITEM_CATEGORIES = SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos;

/** @deprecated Use SUPPLIER_SUBCATEGORIES_BY_TYPE['prestadores'] instead */
export const SERVICE_CATEGORIES = SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores;

/** @deprecated Use getAllSupplierSubcategories() instead */
export const ALL_CATEGORIES = getAllSupplierSubcategories();

export function isServiceCategory(category: string): boolean {
  return (SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores as readonly string[]).includes(category);
}
