import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  generateActivitiesFromTemplate,
  type ActivityTemplateSet,
} from "@/data/activityTemplates";
import {
  type ActivityFormData,
  type ColumnMapping,
  type ImportStep,
  REQUIRED_FIELDS,
  FIELD_LABELS,
} from "./import-schedule/types";
import { autoMapColumns, mapRawToActivities } from "./import-schedule/utils";
import { UploadStep } from "./import-schedule/UploadStep";
import { MappingStep } from "./import-schedule/MappingStep";
import { PreviewStep } from "./import-schedule/PreviewStep";

interface ImportScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (activities: ActivityFormData[]) => void;
}

export const ImportScheduleModal = ({
  open,
  onOpenChange,
  onImport,
}: ImportScheduleModalProps) => {
  const [step, setStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    description: "",
    plannedStart: "",
    plannedEnd: "",
    actualStart: "",
    actualEnd: "",
    weight: "",
  });
  const [mappedData, setMappedData] = useState<ActivityFormData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setColumnMapping({
      description: "",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      weight: "",
    });
    setMappedData([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const fileName = file.name.toLowerCase();
      let data: Record<string, string>[] = [];

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        data = result.data as Record<string, string>[];
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet, {
          raw: false,
          dateNF: "yyyy-mm-dd",
        }) as Record<string, string>[];
      } else {
        toast.error(
          "Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)",
        );
        return;
      }

      if (data.length === 0) {
        toast.error("Arquivo vazio ou sem dados válidos");
        return;
      }

      const detectedHeaders = Object.keys(data[0]).map(
        // eslint-disable-next-line no-control-regex
        (h) =>
          h
            .trim()
            .slice(0, 120)
            .replace(/[\u0000-\u001F\u007F]/g, ""),
      );
      setHeaders(detectedHeaders);
      setRawData(data);
      setColumnMapping(autoMapColumns(detectedHeaders));
      setStep("mapping");
      toast.success(`${data.length} linhas detectadas`);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTemplateSelect = (template: ActivityTemplateSet) => {
    const activities = generateActivitiesFromTemplate(template);
    setMappedData(activities);
    setStep("preview");
    toast.success(
      `Template "${template.name}" carregado com ${activities.length} atividades`,
    );
  };

  const processMapping = () => {
    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !columnMapping[field],
    );
    if (missingFields.length > 0) {
      toast.error(
        `Mapeie os campos obrigatórios: ${missingFields.map((f) => FIELD_LABELS[f]).join(", ")}`,
      );
      return;
    }

    const { valid, errors } = mapRawToActivities(rawData, columnMapping);
    if (valid.length === 0) {
      toast.error("Nenhuma atividade válida encontrada após o processamento");
      return;
    }

    if (errors.length > 0) {
      const detail = errors
        .slice(0, 3)
        .map((e) => `linha ${e.row} (${e.reason})`)
        .join("; ");
      toast.warning(
        `${valid.length}/${rawData.length} atividades válidas. ${errors.length} ignoradas: ${detail}${errors.length > 3 ? "…" : ""}`,
      );
    }

    setMappedData(valid);
    setStep("preview");
  };

  const handleImport = () => {
    onImport(mappedData);
    handleOpenChange(false);
    toast.success(`${mappedData.length} atividades importadas com sucesso`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Cronograma
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Faça upload de uma planilha com as atividades do cronograma"}
            {step === "mapping" &&
              "Mapeie as colunas da planilha para os campos do sistema"}
            {step === "preview" && "Revise os dados antes de importar"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <UploadStep
            onFileUpload={handleFileUpload}
            onTemplateSelect={handleTemplateSelect}
            isProcessing={isProcessing}
          />
        )}
        {step === "mapping" && (
          <MappingStep
            headers={headers}
            columnMapping={columnMapping}
            onMappingChange={(field, value) =>
              setColumnMapping((prev) => ({ ...prev, [field]: value }))
            }
            onBack={() => setStep("upload")}
            onContinue={processMapping}
          />
        )}
        {step === "preview" && (
          <PreviewStep
            mappedData={mappedData}
            onBack={() => setStep("mapping")}
            onImport={handleImport}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
