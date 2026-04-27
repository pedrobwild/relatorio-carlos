import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, Package, ArrowDownToLine, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useStockItems,
  StockItem,
  STOCK_CATEGORY_LABELS,
  STOCK_CATEGORIES,
  StockCategory,
} from '@/hooks/useStockItems';
import { useStockMovements } from '@/hooks/useStockMovements';
import { matchesSearch } from '@/lib/searchNormalize';
import { StockKPICards } from './estoque/StockKPICards';
import { StockItemsTable } from './estoque/StockItemsTable';
import { StockMovementsTable } from './estoque/StockMovementsTable';
import { StockItemDialog } from './estoque/StockItemDialog';
import { StockMovementDialog } from './estoque/StockMovementDialog';

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Estoque() {
  const { projectId } = useParams<{ projectId: string }>();

  const {
    items,
    isLoading: loadingItems,
    createItem,
    updateItem,
    archiveItem,
    deleteItem,
  } = useStockItems(projectId);

  const {
    movements,
    isLoading: loadingMovements,
    createMovement,
    deleteMovement,
  } = useStockMovements(projectId);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | StockCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'comprar' | 'sem_estoque' | 'ok'>('all');

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [movInitialItem, setMovInitialItem] = useState<string | null>(null);

  // Derived
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        return matchesSearch(searchQuery, [
          it.name,
          it.code ?? '',
          it.description ?? '',
          it.supplier_name ?? '',
        ]);
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, searchQuery]);

  const alertItems = useMemo(
    () => items.filter((i) => i.status !== 'ok'),
    [items],
  );

  const lossMovements = useMemo(
    () => movements.filter((m) => m.movement_type === 'perda' || m.movement_type === 'sobra'),
    [movements],
  );

  const kpis = useMemo(() => {
    const totalItems = items.length;
    const toBuyCount = items.filter((i) => i.status === 'comprar').length;
    const outOfStockCount = items.filter((i) => i.status === 'sem_estoque').length;
    const stockValue = items.reduce((acc, i) => acc + (Number(i.stock_value) || 0), 0);
    const lossValue = items.reduce((acc, i) => acc + (Number(i.loss_value) || 0), 0);
    return { totalItems, toBuyCount, outOfStockCount, stockValue, lossValue };
  }, [items]);

  // Handlers
  const handleCreateItem = async (data: Parameters<typeof createItem.mutateAsync>[0]) => {
    await createItem.mutateAsync(data);
  };

  const handleSubmitItem = async (data: Parameters<typeof createItem.mutateAsync>[0]) => {
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await handleCreateItem(data);
    }
  };

  const openMoveFor = (item: StockItem) => {
    setMovInitialItem(item.id);
    setMovDialogOpen(true);
  };

  const openEditFor = (item: StockItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Estoque"
        breadcrumbs={[{ label: 'Obra', href: `/obra/${projectId}` }, { label: 'Estoque' }]}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMovInitialItem(null);
              setMovDialogOpen(true);
            }}
            disabled={items.length === 0}
          >
            <ArrowDownToLine className="h-4 w-4 mr-1.5" />
            Movimentar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setItemDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo item
          </Button>
        </div>
      </PageHeader>

      <PageContainer>
        <div className="space-y-5">
          <StockKPICards {...kpis} />

          {/* Alertas de compra */}
          {alertItems.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/[0.03]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="font-medium text-sm">
                    Itens que precisam de atenção
                  </h3>
                  <Badge variant="outline" className="ml-1">
                    {alertItems.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {alertItems.slice(0, 6).map((it) => {
                    const need = Math.max(0, Number(it.minimum_stock) - Number(it.current_stock));
                    return (
                      <button
                        key={it.id}
                        onClick={() => openMoveFor(it)}
                        className="text-left rounded-md border border-border/60 bg-background hover:bg-accent/40 transition px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{it.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            Saldo {Number(it.current_stock).toLocaleString('pt-BR')} {it.unit}
                            {need > 0 && (
                              <> · repor {need.toLocaleString('pt-BR')} {it.unit}</>
                            )}
                          </p>
                        </div>
                        {it.status === 'sem_estoque' ? (
                          <Badge variant="destructive" className="shrink-0">Zerado</Badge>
                        ) : (
                          <Badge className="shrink-0 bg-amber-500 hover:bg-amber-500/90 text-white">
                            Comprar
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                {alertItems.length > 6 && (
                  <p className="text-xs text-muted-foreground">
                    +{alertItems.length - 6} outros itens precisam de atenção. Veja a aba Itens.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="items" className="space-y-4">
            <TabsList>
              <TabsTrigger value="items">
                <Package className="h-4 w-4 mr-1.5" />
                Itens
              </TabsTrigger>
              <TabsTrigger value="movements">
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Movimentações
              </TabsTrigger>
              <TabsTrigger value="losses">
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                Perdas e sobras
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, código ou fornecedor"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => setCategoryFilter(v as 'all' | StockCategory)}
                >
                  <SelectTrigger className="sm:w-[200px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {STOCK_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {STOCK_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="comprar">Comprar</SelectItem>
                    <SelectItem value="sem_estoque">Sem estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingItems ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Carregando itens…
                </div>
              ) : (
                <StockItemsTable
                  items={filteredItems}
                  onEdit={openEditFor}
                  onMove={openMoveFor}
                  onArchive={(it) => archiveItem.mutate(it.id)}
                  onDelete={(it) => deleteItem.mutate(it.id)}
                  onAdd={() => {
                    setEditingItem(null);
                    setItemDialogOpen(true);
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="movements" className="space-y-3">
              {loadingMovements ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Carregando movimentações…
                </div>
              ) : (
                <StockMovementsTable
                  movements={movements}
                  onDelete={(m) => deleteMovement.mutate(m.id)}
                />
              )}
            </TabsContent>

            <TabsContent value="losses" className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Valor de perdas</p>
                    <p className="text-2xl font-semibold tabular-nums text-destructive">
                      {fmtMoney(kpis.lossValue)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Use a causa e a ação preventiva para evitar repetir o erro.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Movimentações de perda/sobra</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {lossMovements.length}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Quanto menor, melhor a previsibilidade da obra.
                    </p>
                  </CardContent>
                </Card>
              </div>
              <StockMovementsTable
                movements={lossMovements}
                onDelete={(m) => deleteMovement.mutate(m.id)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>

      <StockItemDialog
        open={itemDialogOpen}
        onOpenChange={(v) => {
          setItemDialogOpen(v);
          if (!v) setEditingItem(null);
        }}
        projectId={projectId ?? ''}
        initial={editingItem}
        onSubmit={handleSubmitItem}
      />

      <StockMovementDialog
        open={movDialogOpen}
        onOpenChange={setMovDialogOpen}
        projectId={projectId ?? ''}
        items={items}
        initialItemId={movInitialItem}
        onSubmit={(data) => createMovement.mutateAsync(data).then(() => undefined)}
      />
    </>
  );
}
