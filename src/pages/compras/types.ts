import { Clock, Package, Truck, CheckCircle2, X } from 'lucide-react';
import { PurchaseStatus } from '@/hooks/useProjectPurchases';
import type { PurchaseInput } from '@/hooks/useProjectPurchases';

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

export const ITEM_CATEGORIES = [
  'Eletrodomésticos',
  'Móveis',
  'Iluminação',
  'Vidros e Espelhos',
  'Acessórios',
  'Revestimentos',
  'Pisos',
  'Enxoval',
] as const;

export const SERVICE_CATEGORIES = [
  'Técnico de Ar-Condicionado',
  'Gesseiro',
  'Pintor',
  'Instalador de Piso',
  'Serviços Gerais',
  'Eletricista',
  'Marcenaria',
  'Empreiteira',
] as const;

export const ALL_CATEGORIES = [...ITEM_CATEGORIES, ...SERVICE_CATEGORIES] as const;

export function isServiceCategory(category: string): boolean {
  return (SERVICE_CATEGORIES as readonly string[]).includes(category);
}
