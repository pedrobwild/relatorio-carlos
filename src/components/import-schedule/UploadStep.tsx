import { Upload, Download, FileSpreadsheet, Loader2, LayoutTemplate, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { activityTemplateSets, type ActivityTemplateSet } from '@/data/activityTemplates';

interface UploadStepProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTemplateSelect: (template: ActivityTemplateSet) => void;
  isProcessing: boolean;
}

export const UploadStep = ({ onFileUpload, onTemplateSelect, isProcessing }: UploadStepProps) => {
  const downloadTemplate = () => {
    const templateData = [
      { 'Descrição': 'Mobilização de Obra', 'Início Previsto': '2025-01-15', 'Término Previsto': '2025-01-20', 'Início Real': '', 'Término Real': '', 'Peso (%)': '5' },
      { 'Descrição': 'Demolição', 'Início Previsto': '2025-01-21', 'Término Previsto': '2025-02-05', 'Início Real': '', 'Término Real': '', 'Peso (%)': '10' },
      { 'Descrição': 'Alvenaria', 'Início Previsto': '2025-02-06', 'Término Previsto': '2025-03-15', 'Início Real': '', 'Término Real': '', 'Peso (%)': '25' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    XLSX.writeFile(wb, 'modelo-cronograma.xlsx');
    toast.success('Template baixado');
  };

  return (
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
            onClick={() => onTemplateSelect(template)}
            role="button"
            tabIndex={0}
            aria-label={`Selecionar modelo ${template.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTemplateSelect(template);
              }
            }}
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
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={onFileUpload} className="max-w-xs mx-auto" disabled={isProcessing} />
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
};
