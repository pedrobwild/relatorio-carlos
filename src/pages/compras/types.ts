import { Clock, Package, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PurchaseStatus } from '@/hooks/useProjectPurchases';
import type { PurchaseInput } from '@/hooks/useProjectPurchases';

export const statusConfig: Record<PurchaseStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/20 text-amber-700 border-amber-500/30', icon: Clock },
  ordered: { label: 'Pedido', color: 'bg-blue-500/20 text-blue-700 border-blue-500/30', icon: Package },
  in_transit: { label: 'Em Trânsito', color: 'bg-purple-500/20 text-purple-700 border-purple-500/30', icon: import('lucide-react').then(m => m.Truck) as any },
  delivered: { label: 'Entregue', color: 'bg-green-500/20 text-green-700 border-green-500/30', icon: CheckCircle2 },
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
