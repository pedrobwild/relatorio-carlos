import { Check, Upload } from'lucide-react';
import { Button } from'@/components/ui/button';
import { Alert, AlertDescription } from'@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import type { ActivityFormData } from'./types';

interface PreviewStepProps {
 mappedData: ActivityFormData[];
 onBack: () => void;
 onImport: () => void;
}

export const PreviewStep = ({ mappedData, onBack, onImport }: PreviewStepProps) => (
 <div className="space-y-4">
 <Alert className="bg-success-light border-[hsl(var(--success))]/20">
 <Check className="h-4 w-4 text-[hsl(var(--success))]" />
 <AlertDescription className="text-[hsl(var(--success))]">
 {mappedData.length} atividades prontas para importação
 </AlertDescription>
 </Alert>

 <div className="max-h-[300px] overflow-auto border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-12">#</TableHead>
 <TableHead>Descrição</TableHead>
 <TableHead>Início Prev.</TableHead>
 <TableHead>Término Prev.</TableHead>
 <TableHead className="text-right">Peso</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {mappedData.slice(0, 10).map((activity, index) => (
 <TableRow key={activity.id}>
 <TableCell className="font-medium">{index + 1}</TableCell>
 <TableCell className="max-w-[200px] truncate">{activity.description}</TableCell>
 <TableCell>{activity.plannedStart ||'-'}</TableCell>
 <TableCell>{activity.plannedEnd ||'-'}</TableCell>
 <TableCell className="text-right">{activity.weight}%</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 {mappedData.length > 10 && (
 <p className="text-sm text-muted-foreground text-center">
 ... e mais {mappedData.length - 10} atividades
 </p>
 )}

 <div className="flex justify-between pt-4 border-t">
 <Button variant="outline" onClick={onBack} className="min-h-[44px]">Voltar</Button>
 <Button onClick={onImport} className="min-h-[44px]">
 <Upload className="h-4 w-4 mr-2" />
 Importar {mappedData.length} Atividades
 </Button>
 </div>
 </div>
);
