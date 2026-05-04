import { useState } from'react';
import { Plus, Trash2, ChevronRight, Sparkles, CreditCard } from'lucide-react';
import { EmptyState } from'@/components/ui-premium';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from'@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from'@/components/ui/alert-dialog';
import { Badge } from'@/components/ui/badge';
import { format } from'date-fns';
import type { Payment } from'./types';
import { PaymentMethodModal } from'@/components/PaymentMethodModal';

const PAYMENT_METHODS = [
 { value:'boleto', label:'Boleto' },
 { value:'pix', label:'PIX' },
 { value:'transferencia', label:'Transferência' },
 { value:'cartao', label:'Cartão' },
 { value:'cheque', label:'Cheque' },
];

const METHOD_LABEL: Record<string, string> = Object.fromEntries(
 PAYMENT_METHODS.map(m => [m.value, m.label])
);

const currencyFmt = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });

interface TabPagamentosProps {
 payments: Payment[];
 projectId: string;
 onAdd: (p: { description: string; amount: string; due_date: string; dueDatePending: boolean; payment_method: string }) => Promise<boolean>;
 onUpdate: (id: string, field: string, value: string | number | null) => Promise<void>;
 onTogglePaid: (p: Payment) => Promise<void>;
 onDelete: (id: string) => Promise<void>;
 onRefresh?: () => void | Promise<void>;
}

export function TabPagamentos({ payments, projectId, onAdd, onUpdate, onTogglePaid, onDelete, onRefresh }: TabPagamentosProps) {
 const [newPayment, setNewPayment] = useState({ description:'', amount:'', due_date:'', dueDatePending: false, payment_method:'' });
 const [methodModal, setMethodModal] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null });

 const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
 const paidPayments = payments.filter(p => p.paid_at).reduce((sum, p) => sum + p.amount, 0);

 const handleAdd = async () => {
 const ok = await onAdd(newPayment);
 if (ok) setNewPayment({ description:'', amount:'', due_date:'', dueDatePending: false, payment_method:'' });
 };

 const openMethodModal = (p: Payment) => setMethodModal({ open: true, payment: p });

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
 <p className="text-h3 font-bold text-emerald-600">{currencyFmt.format(paidPayments)}</p>
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
 <Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value, dueDatePending: false })} disabled={newPayment.dueDatePending} className={newPayment.dueDatePending ?'opacity-50' :''} />
 <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
 <input type="checkbox" checked={newPayment.dueDatePending} onChange={(e) => setNewPayment({ ...newPayment, dueDatePending: e.target.checked, due_date:'' })} className="rounded" />
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
 <div className="overflow-x-auto">
 <Table className="min-w-[900px]">
 <TableHeader>
 <TableRow>
 <TableHead className="w-16 whitespace-nowrap">Parcela</TableHead>
 <TableHead className="min-w-[180px] whitespace-nowrap">Descrição</TableHead>
 <TableHead className="w-28 whitespace-nowrap">Valor</TableHead>
 <TableHead className="whitespace-nowrap">Forma Pgto</TableHead>
 <TableHead className="whitespace-nowrap">Vencimento</TableHead>
 <TableHead className="whitespace-nowrap">Status</TableHead>
 <TableHead className="w-12"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {payments.map((p) => {
 const hasMethodDetails =
 (p.payment_method ==='pix' && p.pix_key) ||
 (p.payment_method ==='boleto' && (p.boleto_code || p.boleto_path));
 return (
 <TableRow key={p.id}>
 <TableCell className="font-medium whitespace-nowrap">#{p.installment_number}</TableCell>
 <TableCell><Input value={p.description} onChange={(e) => onUpdate(p.id,'description', e.target.value)} className="h-8 min-w-[160px]" /></TableCell>
 <TableCell><Input type="number" step="0.01" value={p.amount} onChange={(e) => onUpdate(p.id,'amount', parseFloat(e.target.value))} className="h-8 w-28" /></TableCell>
 <TableCell>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-8 justify-between gap-2 min-w-[140px]"
 onClick={() => openMethodModal(p)}
 >
 <span className="flex items-center gap-1.5 truncate">
 {p.payment_method ? METHOD_LABEL[p.payment_method] || p.payment_method : <span className="text-muted-foreground">Definir</span>}
 {hasMethodDetails && (
 <Badge variant="secondary" className="h-4 px-1 text-[10px]">
 <Sparkles className="h-2.5 w-2.5 mr-0.5" />ok
 </Badge>
 )}
 </span>
 <ChevronRight className="h-3.5 w-3.5 opacity-60" />
 </Button>
 </TableCell>
 <TableCell>
 <div className="space-y-1">
 <Input type="date" value={p.due_date ||''} onChange={(e) => onUpdate(p.id,'due_date', e.target.value || null)} className="h-8 w-36" disabled={!p.due_date && p.due_date !==''} />
 <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
 <input type="checkbox" checked={p.due_date === null} onChange={(e) => { onUpdate(p.id,'due_date', e.target.checked ? null : format(new Date(),'yyyy-MM-dd')); }} className="rounded" />
 Em definição
 </label>
 </div>
 </TableCell>
 <TableCell>
 <Button variant={p.paid_at ?'default' :'outline'} size="sm" onClick={() => onTogglePaid(p)} className={`whitespace-nowrap ${p.paid_at ?'bg-emerald-600 hover:bg-emerald-700' :''}`}>
 {p.paid_at ?'Pago' :'Marcar pago'}
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
 );
 })}
 </TableBody>
 </Table>
 </div>
 ) : (
 <EmptyState
 icon={CreditCard}
 title="Nenhuma parcela cadastrada"
 description="Adicione a primeira parcela acima para começar."
 size="sm"
 bare
 />
 )}
 </CardContent>
 </Card>

 {methodModal.payment && (
 <PaymentMethodModal
 open={methodModal.open}
 onOpenChange={(open) => setMethodModal((s) => ({ ...s, open }))}
 paymentId={methodModal.payment.id}
 projectId={projectId}
 installmentNumber={methodModal.payment.installment_number}
 description={methodModal.payment.description}
 initialMethod={(methodModal.payment.payment_method ||'') as'pix' |'boleto' |'cartao' |'transferencia' |'cheque' |''}
 initialPixKey={methodModal.payment.pix_key}
 initialBoletoCode={methodModal.payment.boleto_code}
 initialBoletoPath={methodModal.payment.boleto_path}
 onSaved={() => { onRefresh?.(); }}
 />
 )}
 </div>
 );
}
