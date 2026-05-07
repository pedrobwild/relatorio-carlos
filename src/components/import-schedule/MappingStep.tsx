import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  type ColumnMapping,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  FIELD_LABELS,
} from "./types";

const NONE_VALUE = "__none__";

interface MappingStepProps {
  headers: string[];
  columnMapping: ColumnMapping;
  onMappingChange: (field: keyof ColumnMapping, value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const MappingStep = ({
  headers,
  columnMapping,
  onMappingChange,
  onBack,
  onContinue,
}: MappingStepProps) => (
  <div className="space-y-6">
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        O sistema detectou automaticamente algumas colunas. Revise e ajuste o
        mapeamento se necessário.
      </AlertDescription>
    </Alert>

    <div className="grid gap-4">
      {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
        <div key={field} className="grid grid-cols-2 gap-4 items-center">
          <Label className="flex items-center gap-2">
            {FIELD_LABELS[field]}
            {REQUIRED_FIELDS.includes(
              field as (typeof REQUIRED_FIELDS)[number],
            ) && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={columnMapping[field] || NONE_VALUE}
            onValueChange={(value) =>
              onMappingChange(field, value === NONE_VALUE ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar coluna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Não mapeado</SelectItem>
              {headers.map((header) => (
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
      <Button variant="outline" onClick={onBack} className="min-h-[44px]">
        Voltar
      </Button>
      <Button onClick={onContinue} className="min-h-[44px]">
        Continuar
      </Button>
    </div>
  </div>
);
