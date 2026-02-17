import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, FileSpreadsheet, Check, AlertCircle, Loader2, LayoutTemplate, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { activityTemplateSets, generateActivitiesFromTemplate, type ActivityTemplateSet } from '@/data/activityTemplates';

interface ActivityFormData {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
  predecessorIds: string[];
}

interface ImportScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (activities: ActivityFormData[]) => void;
}

interface ColumnMapping {
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
}

const REQUIRED_FIELDS = ['description', 'plannedStart', 'plannedEnd'] as const;
const OPTIONAL_FIELDS = ['actualStart', 'actualEnd', 'weight'] as const;

const FIELD_LABELS: Record<string, string> = {
  description: 'Descrição',
  plannedStart: 'Início Previsto',
  plannedEnd: 'Término Previsto',
  actualStart: 'Início Real',
  actualEnd: 'Término Real',
  weight: 'Peso (%)',
};

// Common column name variations for auto-mapping
const COLUMN_ALIASES: Record<string, string[]> = {
  description: ['descrição', 'descricao', 'description', 'atividade', 'activity', 'tarefa', 'task', 'nome', 'name'],
  plannedStart: ['início previsto', 'inicio previsto', 'planned start', 'data início', 'data inicio', 'start date', 'início', 'inicio'],
  plannedEnd: ['término previsto', 'termino previsto', 'planned end', 'data término', 'data termino', 'end date', 'término', 'termino', 'fim'],
  actualStart: ['início real', 'inicio real', 'actual start', 'início efetivo', 'inicio efetivo'],
  actualEnd: ['término real', 'termino real', 'actual end', 'término efetivo', 'termino efetivo'],
  weight: ['peso', 'weight', '%', 'percentual', 'percentage'],
};

export const ImportScheduleModal = ({ open, onOpenChange, onImport }: ImportScheduleModalProps) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    description: '',
    plannedStart: '',
    plannedEnd: '',
    actualStart: '',
    actualEnd: '',
    weight: '',
  });
  const [mappedData, setMappedData] = useState<ActivityFormData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setColumnMapping({
      description: '',
      plannedStart: '',
      plannedEnd: '',
      actualStart: '',
      actualEnd: '',
      weight: '',
    });
    setMappedData([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const autoMapColumns = useCallback((detectedHeaders: string[]) => {
    const mapping: ColumnMapping = {
      description: '',
      plannedStart: '',
      plannedEnd: '',
      actualStart: '',
      actualEnd: '',
      weight: '',
    };

    const normalizedHeaders = detectedHeaders.map(h => h.toLowerCase().trim());

    Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
      const matchIndex = normalizedHeaders.findIndex(header => 
        aliases.some(alias => header.includes(alias))
      );
      if (matchIndex !== -1) {
        mapping[field as keyof ColumnMapping] = detectedHeaders[matchIndex];
      }
    });

    return mapping;
  }, []);

  const parseDate = (value: string | number | undefined): string => {
    if (!value) return '';
    
    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const year = date.y;
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    const strValue = String(value).trim();
    if (!strValue) return '';

    // Try to parse common date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    ];

    // YYYY-MM-DD format
    if (formats[0].test(strValue)) {
      return strValue;
    }

    // DD/MM/YYYY format
    const match1 = strValue.match(formats[1]);
    if (match1) {
      return `${match1[3]}-${match1[2]}-${match1[1]}`;
    }

    // DD-MM-YYYY format
    const match2 = strValue.match(formats[2]);
    if (match2) {
      return `${match2[3]}-${match2[2]}-${match2[1]}`;
    }

    // Try native Date parsing as fallback
    const parsed = new Date(strValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return '';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const fileName = file.name.toLowerCase();
      let data: Record<string, string>[] = [];

      if (fileName.endsWith('.csv')) {
        // Parse CSV
        const text = await file.text();
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });
        data = result.data as Record<string, string>[];
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet, { 
          raw: false,
          dateNF: 'yyyy-mm-dd',
        }) as Record<string, string>[];
      } else {
        toast.error('Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)');
        return;
      }

      if (data.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos');
        return;
      }

      const detectedHeaders = Object.keys(data[0]);
      setHeaders(detectedHeaders);
      setRawData(data);

      // Auto-map columns
      const autoMapping = autoMapColumns(detectedHeaders);
      setColumnMapping(autoMapping);

      setStep('mapping');
      toast.success(`${data.length} linhas detectadas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({ ...prev, [field]: value }));
  };

  const validateMapping = (): boolean => {
    const missingFields = REQUIRED_FIELDS.filter(field => !columnMapping[field]);
    if (missingFields.length > 0) {
      toast.error(`Mapeie os campos obrigatórios: ${missingFields.map(f => FIELD_LABELS[f]).join(', ')}`);
      return false;
    }
    return true;
  };

  const processMapping = () => {
    if (!validateMapping()) return;

    const activities: ActivityFormData[] = rawData.map(row => {
      const plannedStartRaw = columnMapping.plannedStart ? row[columnMapping.plannedStart] : '';
      const plannedEndRaw = columnMapping.plannedEnd ? row[columnMapping.plannedEnd] : '';
      const actualStartRaw = columnMapping.actualStart ? row[columnMapping.actualStart] : '';
      const actualEndRaw = columnMapping.actualEnd ? row[columnMapping.actualEnd] : '';
      const weightRaw = columnMapping.weight ? row[columnMapping.weight] : '';

      return {
        id: crypto.randomUUID(),
        description: columnMapping.description ? String(row[columnMapping.description] || '').trim() : '',
        plannedStart: parseDate(plannedStartRaw),
        plannedEnd: parseDate(plannedEndRaw),
        actualStart: parseDate(actualStartRaw),
        actualEnd: parseDate(actualEndRaw),
        weight: weightRaw ? String(parseFloat(String(weightRaw).replace(',', '.').replace('%', '')) || 0) : '0',
        predecessorIds: [],
      };
    }).filter(act => act.description.trim() !== '');

    if (activities.length === 0) {
      toast.error('Nenhuma atividade válida encontrada após o processamento');
      return;
    }

    setMappedData(activities);
    setStep('preview');
  };

  const handleImport = () => {
    onImport(mappedData);
    handleOpenChange(false);
    toast.success(`${mappedData.length} atividades importadas com sucesso`);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Descrição': 'Mobilização de Obra',
        'Início Previsto': '2025-01-15',
        'Término Previsto': '2025-01-20',
        'Início Real': '',
        'Término Real': '',
        'Peso (%)': '5',
      },
      {
        'Descrição': 'Demolição',
        'Início Previsto': '2025-01-21',
        'Término Previsto': '2025-02-05',
        'Início Real': '',
        'Término Real': '',
        'Peso (%)': '10',
      },
      {
        'Descrição': 'Alvenaria',
        'Início Previsto': '2025-02-06',
        'Término Previsto': '2025-03-15',
        'Início Real': '',
        'Término Real': '',
        'Peso (%)': '25',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Descrição
      { wch: 15 }, // Início Previsto
      { wch: 15 }, // Término Previsto
      { wch: 15 }, // Início Real
      { wch: 15 }, // Término Real
      { wch: 10 }, // Peso
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    XLSX.writeFile(wb, 'modelo-cronograma.xlsx');
    toast.success('Template baixado');
  };

  const handleTemplateSelect = (template: ActivityTemplateSet) => {
    const activities = generateActivitiesFromTemplate(template);
    setMappedData(activities);
    setStep('preview');
    toast.success(`Template "${template.name}" carregado com ${activities.length} atividades`);
  };

  const renderUploadStep = () => (
    <Tabs defaultValue="template" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="template" className="flex-1 gap-1.5">
          <LayoutTemplate className="h-4 w-4" />
          Templates
        </TabsTrigger>
        <TabsTrigger value="upload" className="flex-1 gap-1.5">
          <Upload className="h-4 w-4" />
          Importar planilha
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template" className="space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          Escolha um modelo pré-definido para começar rapidamente
        </p>
        {activityTemplateSets.map((template, index) => (
          <Card
            key={template.id}
            className="cursor-pointer group hover:border-primary hover:shadow-sm transition-all animate-fade-in opacity-0"
            style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
            onClick={() => handleTemplateSelect(template)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleTemplateSelect(template)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <span className="text-xl">{template.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{template.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
                <Badge variant="secondary" className="text-[10px] mt-1">{template.activities.length} atividades</Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="upload" className="space-y-6">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Arraste um arquivo ou clique para selecionar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Suporta arquivos CSV e Excel (.xlsx, .xls)
          </p>
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="max-w-xs mx-auto"
            disabled={isProcessing}
          />
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando arquivo...
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Baixar Planilha Modelo
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );

  const renderMappingStep = () => (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O sistema detectou automaticamente algumas colunas. Revise e ajuste o mapeamento se necessário.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(field => (
          <div key={field} className="grid grid-cols-2 gap-4 items-center">
            <Label className="flex items-center gap-2">
              {FIELD_LABELS[field]}
              {REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]) && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Select
              value={columnMapping[field]}
              onValueChange={(value) => handleMappingChange(field, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar coluna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Não mapeado</SelectItem>
                {headers.map(header => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep('upload')} className="min-h-[44px]">
          Voltar
        </Button>
        <Button onClick={processMapping} className="min-h-[44px]">
          Continuar
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <Alert className="bg-success-light dark:bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/20">
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
                <TableCell>{activity.plannedStart || '-'}</TableCell>
                <TableCell>{activity.plannedEnd || '-'}</TableCell>
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
        <Button variant="outline" onClick={() => setStep('mapping')} className="min-h-[44px]">
          Voltar
        </Button>
        <Button onClick={handleImport} className="min-h-[44px]">
          <Upload className="h-4 w-4 mr-2" />
          Importar {mappedData.length} Atividades
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Cronograma
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de uma planilha com as atividades do cronograma'}
            {step === 'mapping' && 'Mapeie as colunas da planilha para os campos do sistema'}
            {step === 'preview' && 'Revise os dados antes de importar'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'preview' && renderPreviewStep()}
      </DialogContent>
    </Dialog>
  );
};
