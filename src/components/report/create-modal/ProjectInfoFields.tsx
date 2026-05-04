import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Building2,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ProjectInfoFieldsProps {
  projectName: string;
  setProjectName: (v: string) => void;
  unitName: string;
  setUnitName: (v: string) => void;
  clientName: string;
  setClientName: (v: string) => void;
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  reportDate: Date;
  setReportDate: (d: Date) => void;
}

const formatDisplay = (date: Date | undefined) =>
  date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "";

const DatePickerField = ({
  label,
  icon: Icon,
  date,
  onSelect,
  className,
  hint,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
  className?: string;
  hint?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <Label className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? formatDisplay(date) : "Selecione a data"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const ProjectInfoFields = ({
  projectName,
  setProjectName,
  unitName,
  setUnitName,
  clientName,
  setClientName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  reportDate,
  setReportDate,
}: ProjectInfoFieldsProps) => (
  <div className="space-y-4">
    <h3 className="text-h3 text-muted-foreground uppercase tracking-wider">
      Informações do Projeto
    </h3>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="projectName" className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Nome do Empreendimento
        </Label>
        <Input
          id="projectName"
          placeholder="Ex: Condomínio Residencial Aurora"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitName">Unidade</Label>
        <Input
          id="unitName"
          placeholder="Ex: Apartamento 502"
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="clientName" className="flex items-center gap-1.5">
        <User className="w-3.5 h-3.5" />
        Nome do Cliente
      </Label>
      <Input
        id="clientName"
        placeholder="Ex: João da Silva"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        required
      />
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <DatePickerField
        label="Data de Início"
        icon={Calendar}
        date={startDate}
        onSelect={setStartDate}
      />
      <DatePickerField
        label="Data de Término Prevista"
        icon={Calendar}
        date={endDate}
        onSelect={setEndDate}
      />
    </div>

    <DatePickerField
      label="Data de Geração do Relatório"
      icon={FileText}
      date={reportDate}
      onSelect={(d) => d && setReportDate(d)}
      className="md:w-auto"
      hint={'Define até onde a linha "realizado" aparece na Curva S'}
    />
  </div>
);
