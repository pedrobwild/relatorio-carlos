import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import type { Payment } from './types';

const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'cheque', label: 'Cheque' },
];

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface TabPagamentosProps {
  payments: Payment[];
  onAdd: (p: { description: string; amount: string; due_date: string; dueDatePending: boolean; payment_method: string }) => Promise<boolean>;
  onUpdate: (id: string, field: string, value: string | number | null) => Promise<void>;
  onTogglePaid: (p: Payment) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TabPagamentos({ payments, onAdd, onUpdate, onTogglePaid, onDelete }: TabPagamentosProps) {
  const [newPayment, setNewPayment] = useState({ description: '', amount: '', due_date: '', dueDatePending: false, payment_method: '' });

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidPayments = payments.filter(p => p.paid_at).reduce((sum, p) => sum + p.amount, 0);

  const handleAdd = async () => {
    const ok = await onAdd(newPayment);
    if (ok) setNewPayment({ description: '', amount: '', due_date: '', dueDatePending: false, payment_method: '' });
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground">Valor Total</p>
          <p className="text-h3 font-bold">{currencyFmt.format(totalPayments)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground">Pago</p>
          <p className="text-h3 font-bold text-green-600">{currencyFmt.format(paidPayments)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground">A Receber</p>
          <p className="text-h3 font-bold text-amber-600">{currencyFmt.format(totalPayments - paidPayments)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
          <CardDescription>{payments.length} parcelas cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add form */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input placeholder="Ex: Parcela de entrada" value={newPayment.description} onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={newPayment.payment_method} onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <div className="space-y-2">
                <Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value, dueDatePending: false })} disabled={newPayment.dueDatePending} className={newPayment.dueDatePending ? 'opacity-50' : ''} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={newPayment.dueDatePending} onChange={(e) => setNewPayment({ ...newPayment, dueDatePending: e.target.checked, due_date: '' })} className="rounded" />
                  Em definição
                </label>
              </div>
            </div>
            <div className="sm:col-span-5 flex justify-end">
              <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />Adicionar Parcela</Button>
            </div>
          </div>

          {/* Table */}
          {payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Parcela</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-28">Valor</TableHead>
                  <TableHead>Forma Pgto</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">#{p.installment_number}</TableCell>
                    <TableCell><Input value={p.description} onChange={(e) => onUpdate(p.id, 'description', e.target.value)} className="h-8" /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={p.amount} onChange={(e) => onUpdate(p.id, 'amount', parseFloat(e.target.value))} className="h-8 w-28" /></TableCell>
                    <TableCell>
                      <Select value={p.payment_method || ''} onValueChange={(v) => onUpdate(p.id, 'payment_method', v || null)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input type="date" value={p.due_date || ''} onChange={(e) => onUpdate(p.id, 'due_date', e.target.value || null)} className="h-8 w-36" disabled={!p.due_date && p.due_date !== ''} />
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={p.due_date === null} onChange={(e) => { onUpdate(p.id, 'due_date', e.target.checked ? null : format(new Date(), 'yyyy-MM-dd')); }} className="rounded" />
                          Em definição
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant={p.paid_at ? 'default' : 'outline'} size="sm" onClick={() => onTogglePaid(p)} className={p.paid_at ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                        {p.paid_at ? 'Pago' : 'Marcar pago'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover parcela?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(p.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhuma parcela cadastrada. Adicione a primeira acima.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
